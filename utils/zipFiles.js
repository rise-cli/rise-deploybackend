import * as filesystem from 'rise-filesystem-foundation'
import process from 'node:process'

function getLambdaFunctionPaths(folderName) {
    let lambdas = []
    try {
        lambdas = filesystem.getDirectories({
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

/**
 * @param {object} config
 * @param {string} config.functionsLocation
 * @param {string} config.zipTarget
 * @param {string} config.hiddenFolder
 */
export async function zipLambdas(config) {
    const lambdas = getLambdaFunctionPaths(config.functionsLocation)
    for (const lambda of lambdas) {
        await filesystem.zipFolder({
            source: lambda.path,
            target: config.zipTarget,
            name: lambda.name,
            projectRoot: process.cwd()
        })
    }
}
