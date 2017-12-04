const JenkinsLib = require('jenkins');
import { CIExecutor } from '../lib/CIExecutor';
import { Utils } from '../lib/utils';

export class CIExecutorJenkins extends CIExecutor {

    constructor(options) {
        super();
        this.options = options;
        this.jenkins = JenkinsLib({ baseUrl: Utils.formatBasicAuth(this.options.username, this.options.password, this.options.url), crumbIssuer: true, promisify: true });
    }

    info() {
        this.executeTask('Functional', {test: 'Testing'});
        return 'Auto-Registered Executor for Jenkins';
    }

    taskNameToBuild(taskName) {
        console.debug(taskName);
        return 'EXECUTE_AUTOMATED_TESTS';
    }

    async waitForBuild(buildName, buildNumber) {
        let buildDict = await this.jenkins.build.get(buildName, buildNumber).then(function(data) {
            return data;
        });
        let tries = 1;
        while(buildDict.result === null) {
            buildDict = await this.jenkins.build.get(buildName, buildNumber).then(function(data) {
                console.log('Waiting for Build \'' + buildName + '\' to Finish: ' + tries++);
                return data;
            });
        }
        return buildDict.result;
    }

    async executeTask(taskName, buildParams) {
        let jobName = this.taskNameToBuild(taskName);
        console.debug(buildParams);
        let buildNumber = await this.jenkins.job.build({ name: jobName, parameters: buildParams });
        let result = await this.waitForBuild(jobName, buildNumber);
        console.log('Build Finished: ' + result);
        return result === 'SUCCESS';  // todo handle results
    }

}

CIExecutor.register('Jenkins', CIExecutorJenkins);