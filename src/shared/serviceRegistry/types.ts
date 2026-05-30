export interface ServiceInfo {
  serviceName: string;
  processType: 'main' | 'preload' | 'renderer';
}
