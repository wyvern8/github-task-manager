import { Executor } from '../agent/Executor';
import { ExecutorDocker } from './ExecutorDocker';
import { default as _ } from 'lodash';
import { AgentUtils } from '../agent/AgentUtils';

/**
 * Sample .githubTaskManager.json task config
 *
 * see: https://github.com/wyvern8/github-task-manager/wiki/Structure-of-.githubTaskManager.json
 *
{
  "pull_request": {
    "agentGroup": "K8S",
    "tasks": [
      {
        "executor": "DockerSonar",
        "context": "Scan PR",
        "options": {
           "env": {"BUILD_TYPE": "nodejs"}
        }
      }
    ]
  }
}

 *
 */

export class ExecutorDockerSonar extends ExecutorDocker {
    constructor(eventData, log) {
        super(eventData, log);
        this.eventData = eventData;
        this.log = log;
    }

    async executeTask(task) {
        task.options = this.mergeTaskOptions(task);
        return super.executeTask(task);
    }

    mergeTaskOptions(task) {
        let options = {
            image: 'zotoio/gtm-worker:latest',
            command: '/usr/workspace/sonar-pullrequest.sh',
            env: {
                BUILD_TYPE: 'maven',
                GIT_CLONE: '##GH_CLONE_URL##',
                GIT_PR_ID: '##GHPRNUM##',
                GIT_PR_BRANCHNAME: '##GH_PR_BRANCHNAME##',
                SONAR_GITHUB_REPOSITORY: '##GH_REPOSITORY_FULLNAME##',
                SONAR_HOST_URL: '##GTM_SONAR_HOST_URL##',
                SONAR_GITHUB_OATH: '##GTM_SONAR_GITHUB_OAUTH##',
                SONAR_LOGIN: '##GTM_SONAR_LOGIN##',
                SONAR_PROJECTNAME_PREFIX: '##GTM_SONAR_PROJECTNAME_PREFIX##',
                SONAR_ANALYSIS_MODE: '##GTM_SONAR_ANALYSIS_MODE##',
                SONAR_GITHUB_OAUTH: '##GTM_SONAR_GITHUB_OAUTH##',
                SONAR_SOURCES: '##GTM_SONAR_SOURCES##'
            },
            validator: {
                type: 'outputRegex',
                regex: '.*ANALYSIS SUCCESSFUL.*'
            }
        };

        // options defined above can be overidden by options in .githubTaskManager.json
        task.options = _.merge(options, task.options);

        task.options = AgentUtils.applyTransforms(
            AgentUtils.templateReplace(
                AgentUtils.createBasicTemplate(this.eventData, {}, this.log),
                task.options,
                this.log
            )
        );

        return task.options;
    }
}

Executor.register('DockerSonar', ExecutorDockerSonar);