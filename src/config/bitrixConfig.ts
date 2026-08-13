export interface BitrixConfig {
  webhookBaseUrl: string;
  dealsWebhookUrl: string;
  leadsWebhookUrl: string;
  autoSync: boolean;
  minDate: string; // YYYY-MM-DD
}

const DEFAULT_WEBHOOK = 'https://compton.bitrix24.in/rest/212/ml282niaoub4hrkz/';
const envWebhookUrl = import.meta.env.VITE_BITRIX_WEBHOOK_URL || DEFAULT_WEBHOOK;
const cleanEnvWebhookUrl = envWebhookUrl.endsWith('/') ? envWebhookUrl : `${envWebhookUrl}/`;

export const DEFAULT_BITRIX_CONFIG: BitrixConfig = {
  webhookBaseUrl: cleanEnvWebhookUrl,
  dealsWebhookUrl: `${cleanEnvWebhookUrl}crm.deal.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*`,
  leadsWebhookUrl: `${cleanEnvWebhookUrl}crm.lead.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*`,
  autoSync: true,
  minDate: "2019-01-01"
};

const STORAGE_KEY = 'sales_dashboard_bitrix_config';

export const getStoredBitrixConfig = (): BitrixConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawBase = (parsed.webhookBaseUrl && parsed.webhookBaseUrl.trim()) ? parsed.webhookBaseUrl : DEFAULT_BITRIX_CONFIG.webhookBaseUrl;
      const baseUrl = rawBase.startsWith('http') ? rawBase : DEFAULT_BITRIX_CONFIG.webhookBaseUrl;
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

      return {
        webhookBaseUrl: cleanBase,
        dealsWebhookUrl: parsed.dealsWebhookUrl || `${cleanBase}crm.deal.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*`,
        leadsWebhookUrl: parsed.leadsWebhookUrl || `${cleanBase}crm.lead.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*`,
        autoSync: parsed.autoSync !== undefined ? parsed.autoSync : true,
        minDate: parsed.minDate || DEFAULT_BITRIX_CONFIG.minDate
      };
    }
  } catch (err) {
    console.warn("Could not load stored Bitrix24 config, using default", err);
  }
  return DEFAULT_BITRIX_CONFIG;
};

export const saveBitrixConfig = (config: BitrixConfig): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    console.error("Failed to save Bitrix config", err);
    return false;
  }
};
