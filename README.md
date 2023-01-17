# RISE DeplyBackend

## Install

```
npm i rise-deploybackend
```

## Usage

```js
import { deployBackend } from 'rise-deploybackend'

await deployBackend({
    app: {
        appName: 'myapp',
        bucketName: 'my-bucket',
        region: 'us-east-1',
        stage: 'dev',
        accountId: '12341234',
        dashboard: false
    },
    functions: {
        functionA: {
            alarm: {
                threshold: 10,
                snsTopic: 'arn:sns',
                period: 60
            },
            env: {
                TABLE: 'myTable'
            },
            eventRule: {
                source: 'serviceA',
                name: 'somethingHappened',
                eventBus: 'bus'
            },
            permissions: [
                {
                    // ... IAM Permission
                }
            ],
            timeout: 6,
            url: {
                method: 'GET',
                path: '/item'
            }
        }
    },
    deployName: 'myAppDeployment',
    zipConfig: {
        functionsLocation: '/src/lambdas',
        zipTarget: '/.dist/lambdas',
        hiddenFolder: '.dist'
    },
    deployInfra: true,
    additionalResources: {} // CloudFormation
})
```
