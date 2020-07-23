import * as cdk from '@aws-cdk/core';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as events from '@aws-cdk/aws-events';
import * as targets from '@aws-cdk/aws-events-targets';
import * as ecs from '@aws-cdk/aws-ecs';
import * as path from 'path';
import { Duration } from '@aws-cdk/core';
import { ComparisonOperator } from '@aws-cdk/aws-cloudwatch';

export class EventTriggerEcsScheduledTaskStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const queue = new sqs.Queue(this, 'SourceQueue');

    const cwMetricOptions: cw.MetricOptions = {
      period: Duration.minutes(1),
      statistic: 'Sum'
    }

    const notVisibleMetric = queue.metricApproximateNumberOfMessagesNotVisible(cwMetricOptions);
    const visibleMetric = queue.metricApproximateNumberOfMessagesVisible(cwMetricOptions);

    const emptyAlarm = new cw.MathExpression({
      expression: 'notVisibleMetric + visibleMetric',
      period: Duration.minutes(1),
      usingMetrics: {
        notVisibleMetric,
        visibleMetric
      }
    }).createAlarm(this, 'EmptyQueueAlarm', {
      comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      threshold: 0,
      evaluationPeriods: 1
    });

    const rule = new events.Rule(this, 'SQSEmptyRule', {
      eventPattern: {
        source: ['aws.cloudwatch'],
        detailType: ['CloudWatch Alarm State Change'],
        resources: [
          {
            prefix: emptyAlarm.alarmArn
          }
        ] as any[],
        detail: {
          state: {
            value: ['ALARM']
          }
        }
      }
    });

    const cluster = new ecs.Cluster(this, 'Cluster');
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'Job');
    taskDefinition.addContainer('TheContainer', {
      image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, 'eventhandler-image')),
      memoryLimitMiB: 256,
      logging: new ecs.AwsLogDriver({ streamPrefix: 'EventDemo' })
    });

    rule.addTarget(new targets.EcsTask({
      cluster,
      taskDefinition,
      containerOverrides: [{
        containerName: 'TheContainer',
        environment: [{
          name: 'I_WAS_TRIGGERED',
          value: 'From CloudWatch Events'
        }]
      }],
    }));
  }
}
