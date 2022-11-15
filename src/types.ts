/**
 * General
 */
export type None = 'None'

/**
 * Deploy Cli Input
 */
export type DeployCommandInput = {
    stage: string
    region: string
}

export type EventRule = {
    source: string
    name: string
    bus: string
}

export type UrlConfig = {
    method: 'POST' | 'GET' | 'PUT' | 'DELETE'
    path: string
    auth: boolean
}

export type Permission = {
    Action: string | string[]
    Effect: string | string[]
    Resource: string | string[]
}

export type AppConfig = {
    appName: string
    bucketName?: string
    region: string
    stage: string
    accountId: string
    dashboard: boolean
}

export type AlarmConfig = {
    threshold: number
    snsTopic: string
    description?: string
    period?: number
    evaluationPeriods?: number
}

export type FunctionConfig = {
    url: UrlConfig | None
    permissions: Permission[]
    env: Record<string, string>
    eventRule: EventRule | None
    alarm: AlarmConfig | None
    timeout: number
    dashboard?: Record<string, number>
    layers: string[]
}

export type ZipConfig = {
    functionsLocation: string
    zipTarget: string
    hiddenFolder: string
}

export type ProjectConfig = {
    app: AppConfig
    functions: Record<string, FunctionConfig>
    deployName: string
    zipConfig: ZipConfig
    deployInfra: boolean
    additionalResources?: any
}
