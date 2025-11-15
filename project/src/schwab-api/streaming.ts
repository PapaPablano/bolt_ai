import { StreamMessage, StreamerCredentials, StreamerEnvelope, StreamerRequest, StreamerService } from './types.js'
import { SCHWAB_STREAMER_DEFAULT_HEARTBEAT_MS } from './utils.js'

export interface WebSocketLike {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  addEventListener(event: string, listener: (event: unknown) => void): void
  removeEventListener(event: string, listener: (event: unknown) => void): void
}

export type WebSocketFactory = (url: string) => WebSocketLike

export interface SchwabStreamerOptions {
  credentials: StreamerCredentials
  wsFactory?: WebSocketFactory
  heartbeatMs?: number
  onMessage?: (message: StreamMessage) => void
  onError?: (event: unknown) => void
  onClose?: (event: unknown) => void
}

export class SchwabStreamer {
  private options: SchwabStreamerOptions
  private socket: WebSocketLike | null = null
  private requestCounter = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: SchwabStreamerOptions) {
    this.options = options
  }

  async connect(): Promise<WebSocketLike> {
    if (this.socket && this.socket.readyState === 1) {
      return this.socket
    }

    const socket = this.createSocket(this.options.credentials.streamerUrl)
    this.socket = socket

    return new Promise<WebSocketLike>((resolve, reject) => {
      const handleOpen = () => {
        this.removeListeners(socket, handleOpen, handleError, handleClose)
        this.attachRuntimeListeners(socket)
        this.sendLogin()
        resolve(socket)
      }

      const handleError = (event: unknown) => {
        this.removeListeners(socket, handleOpen, handleError, handleClose)
        this.options.onError?.(event)
        reject(event)
      }

      const handleClose = (event: unknown) => {
        this.removeListeners(socket, handleOpen, handleError, handleClose)
        this.options.onClose?.(event)
        reject(event)
      }

      socket.addEventListener('open', handleOpen)
      socket.addEventListener('error', handleError)
      socket.addEventListener('close', handleClose)
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  subscribe(service: StreamerService, symbols: string[], fields: number[], command: 'SUBS' | 'ADD' = 'SUBS'): void {
    this.ensureConnected()
    const request = this.buildRequest(service, command, {
      keys: symbols.join(','),
      fields: fields.join(','),
    })
    this.send({ requests: [request] })
  }

  unsubscribe(service: StreamerService, symbols: string[]): void {
    this.ensureConnected()
    const request = this.buildRequest(service, 'UNSUBS', {
      keys: symbols.join(','),
    })
    this.send({ requests: [request] })
  }

  getSocket(): WebSocketLike | null {
    return this.socket
  }

  private attachRuntimeListeners(socket: WebSocketLike): void {
    const handleMessage = (event: unknown) => {
      if (!event || typeof event !== 'object') {
        return
      }

      const data = (event as { data?: string }).data
      if (typeof data !== 'string') {
        return
      }

      try {
        const parsed = JSON.parse(data) as StreamMessage
        this.options.onMessage?.(parsed)
      } catch (error) {
        this.options.onError?.(error)
      }
    }

    const handleError = (event: unknown) => {
      this.options.onError?.(event)
    }

    const handleClose = (event: unknown) => {
      this.options.onClose?.(event)
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = null
      }
    }

    socket.addEventListener('message', handleMessage)
    socket.addEventListener('error', handleError)
    socket.addEventListener('close', handleClose)

    const heartbeatMs = this.options.heartbeatMs ?? SCHWAB_STREAMER_DEFAULT_HEARTBEAT_MS
    this.heartbeatTimer = setInterval(() => {
      this.ping()
    }, heartbeatMs)
  }

  private removeListeners(
    socket: WebSocketLike,
    openHandler: (event: unknown) => void,
    errorHandler: (event: unknown) => void,
    closeHandler: (event: unknown) => void,
  ): void {
    socket.removeEventListener('open', openHandler)
    socket.removeEventListener('error', errorHandler)
    socket.removeEventListener('close', closeHandler)
  }

  private sendLogin(): void {
    const { credentials } = this.options
    const request: StreamerRequest = {
      requestid: this.nextRequestId(),
      service: 'ADMIN',
      command: 'LOGIN',
      SchwabClientCustomerId: credentials.schwabClientCustomerId,
      SchwabClientCorrelId: credentials.schwabClientCorrelId,
      parameters: {
        Authorization: credentials.accessToken,
        SchwabClientChannel: credentials.schwabClientChannel,
        SchwabClientFunctionId: credentials.schwabClientFunctionId,
      },
    }
    this.send({ requests: [request] })
  }

  private send(envelope: StreamerEnvelope): void {
    this.ensureConnected()
    const payload = JSON.stringify(envelope)
    this.socket!.send(payload)
  }

  private ping(): void {
    if (!this.socket || this.socket.readyState !== 1) {
      return
    }
    const request = this.buildRequest('ADMIN', 'VIEW', {})
    this.send({ requests: [request] })
  }

  private ensureConnected(): void {
    if (!this.socket || this.socket.readyState !== 1) {
      throw new Error('Streamer is not connected. Call connect() first before subscribing or sending requests.')
    }
  }

  private buildRequest(
    service: StreamerService,
    command: StreamerRequest['command'],
    parameters: Record<string, string | undefined>,
  ): StreamerRequest {
    const { credentials } = this.options
    const filteredParameters: Record<string, string> = {}
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined) {
        filteredParameters[key] = value
      }
    }

    return {
      requestid: this.nextRequestId(),
      service,
      command,
      SchwabClientCustomerId: credentials.schwabClientCustomerId,
      SchwabClientCorrelId: credentials.schwabClientCorrelId,
      parameters: filteredParameters,
    }
  }

  private nextRequestId(): string {
    this.requestCounter += 1
    return this.requestCounter.toString()
  }

  private createSocket(url: string): WebSocketLike {
    if (this.options.wsFactory) {
      return this.options.wsFactory(url)
    }

    const globalWs = (globalThis as { WebSocket?: { new (target: string): WebSocketLike } }).WebSocket
    if (!globalWs) {
      throw new Error('WebSocket is not available. Either provide a custom WebSocket factory via wsFactory option, or ensure the runtime supports WebSocket.')
    }

    return new globalWs(url)
  }
}
