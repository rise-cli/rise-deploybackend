import cli from 'cli-foundation'
import { ZipConfig } from '../../types'

function getLambdaFunctionPaths(folderName: string) {
    let lambdas: string[] = []
    try {
        lambdas = cli.filesystem.getDirectories({
            path: folderName,
            projectRoot: process.cwd()
        })
    } catch (e) {
        lambdas = []
    }

    return lambdas.map((name) => {
        return {
            path: folderName + '/' + name,
            name
        }
    })
}

export async function zipLambdas(config: ZipConfig) {
    const lambdas = getLambdaFunctionPaths(config.functionsLocation)
    for (const lambda of lambdas) {
        await cli.filesystem.zipFolder({
            source: lambda.path,
            target: config.zipTarget,
            name: lambda.name,
            projectRoot: process.cwd()
        })
    }
}
