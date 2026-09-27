import { logging, Controllers, HttpMethod } from '../utils';
import {
  AuditLogRetentionConfigurationDto,
  UpdateAuditLogRetentionConfigurationDto,
} from '../types/dtos/userManagement/AuditLogRetentionConfigurationDtos';
import { ObjectManager } from './objectManager';

// The audit log / private message log retention singleton. Reading is open; saving needs
// knk.admin.config (the API answers 403 with "Requires the knk.admin.config permission.").
export class AuditLogRetentionClient extends ObjectManager {
  private static instance: AuditLogRetentionClient;

  public static getInstance() {
    if (!AuditLogRetentionClient.instance) {
      AuditLogRetentionClient.instance = new AuditLogRetentionClient();
      AuditLogRetentionClient.instance.logger = logging.getLogger('AuditLogRetentionClient');
    }
    return AuditLogRetentionClient.instance;
  }

  get(): Promise<AuditLogRetentionConfigurationDto> {
    return this.invokeServiceCall(null, '', Controllers.AuditLogRetentionConfiguration, HttpMethod.Get);
  }

  update(dto: UpdateAuditLogRetentionConfigurationDto): Promise<AuditLogRetentionConfigurationDto> {
    return this.invokeServiceCall(dto, '', Controllers.AuditLogRetentionConfiguration, HttpMethod.Put);
  }
}

export const auditLogRetentionClient = AuditLogRetentionClient.getInstance();
