#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EventTriggerEcsScheduledTaskStack } from '../lib/event-trigger-ecs-scheduled-task-stack';

const app = new cdk.App();
new EventTriggerEcsScheduledTaskStack(app, 'EventTriggerEcsScheduledTaskStack');
