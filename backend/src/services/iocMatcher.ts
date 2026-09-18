import { PrismaClient, Event, IOC, IOCType } from '@prisma/client';

export interface IOCMatchResult {
  iocId: string;
  iocType: IOCType;
  iocValue: string;
  iocConfidence: number;
  iocSource?: string | null;
  iocTags: string[];
  iocDescription?: string | null;
  matchedField: string;
  matchedValue: string;
  matchedAt: Date;
}

type EventMetadata = Record<string, string | number | boolean | null | undefined>;

function getMetadata(event: Event): EventMetadata {
  return (event.metadata as EventMetadata) || {};
}

export class IOCMatcher {
  constructor(private prisma: PrismaClient) {}

  async matchEvent(event: Event): Promise<IOCMatchResult[]> {
    const activeIOCs = await this.prisma.iOC.findMany({
      where: { isActive: true },
    });

    if (activeIOCs.length === 0) return [];

    const matches: IOCMatchResult[] = [];

    for (const ioc of activeIOCs) {
      const matchResult = this.matchIOC(event, ioc);
      if (matchResult) {
        matches.push(matchResult);
      }
    }

    return matches;
  }

  async matchBatch(events: Event[]): Promise<Map<string, IOCMatchResult[]>> {
    const result = new Map<string, IOCMatchResult[]>();

    for (const event of events) {
      const matches = await this.matchEvent(event);
      if (matches.length > 0) {
        result.set(event.id, matches);
      }
    }

    return result;
  }

  async storeMatches(eventId: string, matches: IOCMatchResult[]): Promise<void> {
    if (matches.length === 0) return;

    await this.prisma.iOCMatch.createMany({
      data: matches.map(match => ({
        iocId: match.iocId,
        eventId,
        matchedAt: match.matchedAt,
      })),
      skipDuplicates: true,
    });
  }

  async matchAndStore(event: Event): Promise<IOCMatchResult[]> {
    const matches = await this.matchEvent(event);
    await this.storeMatches(event.id, matches);
    return matches;
  }

  private matchIOC(event: Event, ioc: IOC): IOCMatchResult | null {
    let matchedField = '';
    let matchedValue = '';
    let isMatch = false;

    const metadata = getMetadata(event);

    switch (ioc.type) {
      case 'IP':
        if (event.sourceIp === ioc.value) {
          isMatch = true;
          matchedField = 'sourceIp';
          matchedValue = event.sourceIp!;
        } else if (event.destIp === ioc.value) {
          isMatch = true;
          matchedField = 'destIp';
          matchedValue = event.destIp!;
        }
        break;

      case 'DOMAIN':
        if (event.destIp && this.domainMatches(event.destIp, ioc.value)) {
          isMatch = true;
          matchedField = 'destIp';
          matchedValue = event.destIp;
        }
        if (metadata.domain === ioc.value) {
          isMatch = true;
          matchedField = 'metadata.domain';
          matchedValue = ioc.value;
        }
        break;

      case 'URL':
        if (metadata.url && String(metadata.url).includes(ioc.value)) {
          isMatch = true;
          matchedField = 'metadata.url';
          matchedValue = String(metadata.url);
        }
        break;

      case 'HASH_MD5':
      case 'HASH_SHA1':
      case 'HASH_SHA256':
        for (const [key, value] of Object.entries(metadata)) {
          if (String(value).toLowerCase() === ioc.value.toLowerCase()) {
            isMatch = true;
            matchedField = `metadata.${key}`;
            matchedValue = String(value);
            break;
          }
        }
        break;

      case 'EMAIL':
        if (metadata.email === ioc.value) {
          isMatch = true;
          matchedField = 'metadata.email';
          matchedValue = ioc.value;
        }
        if (event.username?.includes('@') && event.username === ioc.value) {
          isMatch = true;
          matchedField = 'username';
          matchedValue = event.username;
        }
        break;

      case 'CIDR':
        if (event.sourceIp && this.ipInCIDR(event.sourceIp, ioc.value)) {
          isMatch = true;
          matchedField = 'sourceIp';
          matchedValue = event.sourceIp;
        } else if (event.destIp && this.ipInCIDR(event.destIp, ioc.value)) {
          isMatch = true;
          matchedField = 'destIp';
          matchedValue = event.destIp;
        }
        break;

      case 'REGISTRY_KEY':
        if (metadata.registryKey === ioc.value) {
          isMatch = true;
          matchedField = 'metadata.registryKey';
          matchedValue = ioc.value;
        }
        break;

      case 'MUTEX':
        if (metadata.mutex === ioc.value) {
          isMatch = true;
          matchedField = 'metadata.mutex';
          matchedValue = ioc.value;
        }
        break;
    }

    if (!isMatch) return null;

    return {
      iocId: ioc.id,
      iocType: ioc.type,
      iocValue: ioc.value,
      iocConfidence: ioc.confidence,
      iocSource: ioc.source,
      iocTags: ioc.tags,
      iocDescription: ioc.description,
      matchedField,
      matchedValue,
      matchedAt: new Date(),
    };
  }

  private domainMatches(host: string, iocDomain: string): boolean {
    if (host === iocDomain) return true;
    return host.endsWith('.' + iocDomain);
  }

  private ipInCIDR(ip: string, cidr: string): boolean {
    const [rangeIp, bits] = cidr.split('/');
    const mask = parseInt(bits, 10);
    
    const ipParts = ip.split('.').map(Number);
    const rangeParts = rangeIp.split('.').map(Number);
    
    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
    
    const maskNum = ~((1 << (32 - mask)) - 1);
    
    return (ipNum & maskNum) === (rangeNum & maskNum);
  }
}

export const iocMatcher = (prisma: PrismaClient) => new IOCMatcher(prisma);