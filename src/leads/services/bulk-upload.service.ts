import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as XLSX from 'xlsx';
import { Lead, LeadDocument } from '../schemas/lead.schema';
import { LeadScoringService } from './lead-scoring.service';
import { LeadAssignmentService } from './lead-assignment.service';

// All accepted column headers (case-insensitive, spaces/dashes → underscores)
const SAMPLE_HEADERS = [
  'Name',
  'Email',
  'Phone',
  'Company',
  'Source',
  'Budget',
  'Product Interested',
  'Timeline',
  'Location',
  'City',
  'Notes',
];

const SAMPLE_ROWS = [
  {
    Name: 'John Doe',
    Email: 'john@example.com',
    Phone: '9876543210',
    Company: 'Acme Corp',
    Source: 'MANUAL',
    Budget: 500000,
    'Product Interested': 'Enterprise Plan',
    Timeline: '3 months',
    Location: 'Mumbai',
    City: 'Mumbai',
    Notes: 'Very interested in the enterprise plan',
  },
  {
    Name: 'Jane Smith',
    Email: 'jane@example.com',
    Phone: '9123456789',
    Company: 'Globex Inc',
    Source: 'IMPORT',
    Budget: 250000,
    'Product Interested': 'Pro Plan',
    Timeline: '1 month',
    Location: 'Delhi',
    City: 'New Delhi',
    Notes: 'Referral from existing client',
  },
  {
    Name: 'Raj Kumar',
    Email: 'raj@example.com',
    Phone: '9988776655',
    Company: 'Tech Solutions',
    Source: 'MANUAL',
    Budget: 100000,
    'Product Interested': 'Starter Plan',
    Timeline: '6 months',
    Location: 'Bangalore',
    City: 'Bangalore',
    Notes: 'Follow up next week',
  },
];

@Injectable()
export class BulkUploadService {
  constructor(
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private leadScoringService: LeadScoringService,
    private leadAssignmentService: LeadAssignmentService,
  ) {}

  /** Generate and return a Buffer containing the sample XLSX template */
  generateSampleTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: SAMPLE_HEADERS });

    // Set column widths
    ws['!cols'] = SAMPLE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async processBulkLeads(
    fileBuffer: Buffer,
    fileType: string,
    tenantId: string,
    userId: string,
  ) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      // Valid source enum values from schema
      const VALID_SOURCES = ['WHATSAPP', 'CALL', 'EMAIL', 'WEBSITE', 'FACEBOOK', 'IMPORT', 'MANUAL'];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Normalize keys: lowercase, spaces/dashes → underscores
          const n: any = {};
          Object.keys(row).forEach((key) => {
            const k = key.toLowerCase().replace(/[\s\-]+/g, '_');
            n[k] = row[key] === undefined || row[key] === null ? '' : String(row[key]).trim();
          });

          const name = (n.name || n.full_name || '').trim();
          const email = (n.email || '').trim();
          // phoneNumber is REQUIRED in schema — use a placeholder if missing
          const rawPhone = (n.phone || n.phone_number || '').trim();
          const phoneNumber = rawPhone || 'N/A';

          if (!name && !email) {
            failureCount++;
            errors.push(`Row ${i + 2}: Name or Email is required.`);
            continue;
          }

          // Map source to valid enum value
          let rawSource = (n.source || 'IMPORT').toUpperCase().trim();
          if (rawSource === 'BULK_IMPORT' || rawSource === 'EXCEL' || !VALID_SOURCES.includes(rawSource)) {
            rawSource = 'IMPORT';
          }

          const leadData: any = {
            name: name || undefined,
            email: email || undefined,
            phoneNumber,
            company: n.company_name || n.company
              ? { name: (n.company || n.company_name || '').trim() }
              : undefined,
            source: rawSource,
            notes: n.notes || undefined,
            intent: (n.product_interested || n.product || n.budget || n.timeline)
              ? {
                  product: (n.product_interested || n.product || '').trim() || undefined,
                  budget: n.budget ? Number(String(n.budget).replace(/[^0-9.]/g, '')) || undefined : undefined,
                  timeline: n.timeline || undefined,
                }
              : undefined,
            customFields: (n.location || n.city)
              ? { location: n.location || undefined, city: n.city || undefined }
              : undefined,
            tenantId: new Types.ObjectId(tenantId),
            createdBy: new Types.ObjectId(userId),
            lastActivityAt: new Date(),
            status: 'OPEN',
          };

          leadData.leadScore = this.leadScoringService.calculateLeadScore(leadData);
          const assignedTo = await this.leadAssignmentService.getSmartAssignment(tenantId);
          if (assignedTo) {
            leadData.assignedTo = assignedTo;
            leadData.assignedBy = new Types.ObjectId(userId);
          }

          const lead = new this.leadModel(leadData);
          await lead.save();
          successCount++;
        } catch (e: any) {
          failureCount++;
          // Include full validation error details so user can debug their sheet
          const msg = e?.message || String(e);
          errors.push(`Row ${i + 2}: ${msg}`);
        }
      }

      return {
        successCount,
        failureCount,
        errors: errors.slice(0, 20),
        total: data.length,
      };
    } catch (e: any) {
      return {
        successCount: 0,
        failureCount: 0,
        errors: [`File processing error: ${e?.message || String(e)}`],
        total: 0,
      };
    }
  }
}
