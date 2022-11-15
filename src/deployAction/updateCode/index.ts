import cli from 'cli-foundation'
import aws from 'aws-foundation'
import { ZipConfig } from '../../types'

type Input = {
    appName: string
    stage: string
    region: string
    bucket: string
    zipConfig: ZipConfig
}

export async function updateLambdaCode({
    appName,
    stage,
    region,
    bucket,
    zipConfig
}: Input) {
    const getAllPaths = () => {
        const lambaPaths = zipConfig.functionsLocation
        const lambdas = cli.filesystem.getDirectories({
            path: lambaPaths,
            projectRoot: process.cwd()
        })
        const path = zipConfig.zipTarget.split(zipConfig.hiddenFolder + '/')[1]
        return [
            ...lambdas.map((x) => ({
                path: `${path}/${x}.zip`,
                name: x
            }))
        ]
    }

    const getFunctionName = (name: string) => `${appName}-${name}-${stage}`
    for (const l of getAllPaths()) {
        const lambdaName = getFunctionName(l.name)

        await aws.lambda.updateLambdaCode({
            name: lambdaName,
            filePath: l.path,
            bucket: bucket,
            region
        })
    }
}
