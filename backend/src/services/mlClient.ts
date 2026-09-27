import axios, { type AxiosInstance } from 'axios';
import { config } from '@config';
import { logger } from '@utils/logger';

export interface NormalizedEvent {
  timestamp: string;
  event_type: string;
  severity: string;
  source_ip?: string;
  dest_ip?: string;
  username?: string;
  metadata: Record<string, any>;
}

export interface MLFeatureVector {
  hour: number;
  minute: number;
  day_of_week: number;
  event_type: string;
  severity: string;
  has_source_ip: number;
  has_dest_ip: number;
  has_username: number;
  src_first_octet?: number;
  src_is_private?: number;
  dst_first_octet?: number;
  dst_is_private?: number;
  [key: string]: any;
}

export interface MLPredictionResult {
  event_index: number;
  anomaly_score: number;
  is_anomaly: boolean;
  features_used: Record<string, any>;
}

export interface MLPredictResponse {
  predictions: MLPredictionResult[];
  model_version: string;
  processing_time_ms: number;
}

export interface MLHealthResponse {
  status: string;
  service: string;
  version: string;
  model_loaded: boolean;
  model_path: string;
  model_exists: boolean;
}

export class MLClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || config.ML_SERVICE_URL;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.ML_SERVICE_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error({ err: error.message, url: error.config?.url }, 'ML service request failed');
        return Promise.reject(error);
      }
    );
  }

  async predict(events: NormalizedEvent[]): Promise<MLPredictionResult[]> {
    try {
      const response = await this.client.post<MLPredictResponse>('/api/v1/predict', { events });
      return response.data.predictions;
    } catch (error: any) {
      logger.error({ err: error.message, eventsCount: events.length }, 'ML prediction failed');
      return events.map(() => ({
        event_index: 0,
        anomaly_score: 0,
        is_anomaly: false,
        features_used: { error: 'ML service unavailable' },
      }));
    }
  }

  async predictSingle(event: NormalizedEvent): Promise<MLPredictionResult> {
    const results = await this.predict([event]);
    return results[0] || { event_index: 0, anomaly_score: 0, is_anomaly: false, features_used: {} };
  }

  async healthCheck(): Promise<MLHealthResponse> {
    try {
      const response = await this.client.get<MLHealthResponse>('/health');
      return response.data;
    } catch (error: any) {
      logger.error({ err: error.message }, 'ML health check failed');
      return {
        status: 'unhealthy',
        service: 'CyberSentinel ML Service',
        version: 'unknown',
        model_loaded: false,
        model_path: '',
        model_exists: false,
      };
    }
  }

  async getModelInfo(): Promise<any> {
    try {
      const response = await this.client.get('/api/v1/model/info');
      return response.data;
    } catch (error: any) {
      logger.error({ err: error.message }, 'Failed to get model info');
      return null;
    }
  }

  normalizeEvent(event: any): NormalizedEvent {
    return {
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
      event_type: event.eventType,
      severity: event.severity,
      source_ip: event.sourceIp,
      dest_ip: event.destIp,
      username: event.username,
      metadata: event.metadata || {},
    };
  }
}

let mlClientInstance: MLClient | null = null;

export function getMLClient(baseUrl?: string): MLClient {
  if (!mlClientInstance || baseUrl) {
    mlClientInstance = new MLClient(baseUrl);
  }
  return mlClientInstance;
}

export const mlClient = getMLClient();