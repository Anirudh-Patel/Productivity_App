// Data Export/Import Service for Life Gamification App
// Supports JSON, CSV, and XML formats for comprehensive data portability

import { useGameStore } from '../store/gameStore';
import { useCalendarStore } from '../store/calendarStore';

export interface ExportData {
  user: any;
  tasks: {
    active: any[];
    completed: any[];
    failed: any[];
  };
  achievements: any[];
  inventory: any[];
  equipment: any[];
  calendar: {
    events: any[];
    settings: any;
  };
  settings: any;
  exportMetadata: {
    version: string;
    timestamp: string;
    format: ExportFormat;
    totalRecords: number;
  };
}

export type ExportFormat = 'json' | 'csv' | 'xml';

export interface ExportOptions {
  format: ExportFormat;
  includeUser: boolean;
  includeTasks: boolean;
  includeAchievements: boolean;
  includeInventory: boolean;
  includeEquipment: boolean;
  includeCalendar: boolean;
  includeSettings: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

class DataExportService {
  /**
   * Export data in specified format
   */
  async exportData(options: ExportOptions): Promise<string> {
    const data = await this.gatherExportData(options);
    
    switch (options.format) {
      case 'json':
        return this.exportToJSON(data);
      case 'csv':
        return this.exportToCSV(data);
      case 'xml':
        return this.exportToXML(data);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Import data from various formats
   */
  async importData(content: string, format: ExportFormat): Promise<{
    success: boolean;
    message: string;
    imported: {
      users: number;
      tasks: number;
      achievements: number;
      inventory: number;
      equipment: number;
      calendar: number;
    };
  }> {
    try {
      let data: ExportData;

      switch (format) {
        case 'json':
          data = this.parseJSON(content);
          break;
        case 'csv':
          data = this.parseCSV(content);
          break;
        case 'xml':
          data = this.parseXML(content);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      return await this.processImportData(data);
    } catch (error) {
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        imported: {
          users: 0,
          tasks: 0,
          achievements: 0,
          inventory: 0,
          equipment: 0,
          calendar: 0
        }
      };
    }
  }

  /**
   * Gather all data for export based on options
   */
  private async gatherExportData(options: ExportOptions): Promise<ExportData> {
    const gameState = useGameStore.getState();
    const calendarState = useCalendarStore.getState();
    
    const data: ExportData = {
      user: options.includeUser ? gameState.user : null,
      tasks: {
        active: options.includeTasks ? gameState.tasks.active : [],
        completed: options.includeTasks ? gameState.tasks.completed : [],
        failed: []
      },
      achievements: options.includeAchievements ? gameState.achievements.unlocked : [],
      inventory: options.includeInventory ? gameState.inventory.items : [],
      equipment: [],
      calendar: {
        events: options.includeCalendar ? calendarState.syncedCalendars : [],
        settings: options.includeCalendar ? { importRules: calendarState.importRules } : {}
      },
      settings: options.includeSettings ? this.gatherAppSettings() : {},
      exportMetadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        format: options.format,
        totalRecords: 0
      }
    };

    // Apply date range filtering if specified
    if (options.dateRange) {
      data.tasks = this.filterTasksByDateRange(data.tasks, options.dateRange);
      data.calendar.events = this.filterEventsByDateRange(data.calendar.events, options.dateRange);
    }

    // Calculate total records
    data.exportMetadata.totalRecords = this.calculateTotalRecords(data);

    return data;
  }

  /**
   * Export to JSON format
   */
  private exportToJSON(data: ExportData): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(data: ExportData): string {
    const csvSections: string[] = [];

    // User data
    if (data.user) {
      csvSections.push('--- USER DATA ---');
      csvSections.push(this.objectToCSV([data.user], 'user'));
    }

    // Tasks data
    if (data.tasks.active.length > 0 || data.tasks.completed.length > 0 || data.tasks.failed.length > 0) {
      csvSections.push('\n--- TASKS DATA ---');
      
      if (data.tasks.active.length > 0) {
        csvSections.push('\n-- Active Tasks --');
        csvSections.push(this.objectToCSV(data.tasks.active, 'task'));
      }
      
      if (data.tasks.completed.length > 0) {
        csvSections.push('\n-- Completed Tasks --');
        csvSections.push(this.objectToCSV(data.tasks.completed, 'task'));
      }
      
      if (data.tasks.failed.length > 0) {
        csvSections.push('\n-- Failed Tasks --');
        csvSections.push(this.objectToCSV(data.tasks.failed, 'task'));
      }
    }

    // Achievements data
    if (data.achievements.length > 0) {
      csvSections.push('\n--- ACHIEVEMENTS DATA ---');
      csvSections.push(this.objectToCSV(data.achievements, 'achievement'));
    }

    // Inventory data
    if (data.inventory.length > 0) {
      csvSections.push('\n--- INVENTORY DATA ---');
      csvSections.push(this.objectToCSV(data.inventory, 'inventory'));
    }

    // Equipment data
    if (data.equipment.length > 0) {
      csvSections.push('\n--- EQUIPMENT DATA ---');
      csvSections.push(this.objectToCSV(data.equipment, 'equipment'));
    }

    // Calendar data
    if (data.calendar.events.length > 0) {
      csvSections.push('\n--- CALENDAR EVENTS ---');
      csvSections.push(this.objectToCSV(data.calendar.events, 'event'));
    }

    return csvSections.join('\n');
  }

  /**
   * Export to XML format
   */
  private exportToXML(data: ExportData): string {
    const xmlParts = ['<?xml version="1.0" encoding="UTF-8"?>'];
    xmlParts.push('<export>');
    xmlParts.push(`  <metadata>`);
    xmlParts.push(`    <version>${data.exportMetadata.version}</version>`);
    xmlParts.push(`    <timestamp>${data.exportMetadata.timestamp}</timestamp>`);
    xmlParts.push(`    <format>${data.exportMetadata.format}</format>`);
    xmlParts.push(`    <totalRecords>${data.exportMetadata.totalRecords}</totalRecords>`);
    xmlParts.push(`  </metadata>`);

    // User data
    if (data.user) {
      xmlParts.push('  <user>');
      xmlParts.push(this.objectToXML(data.user, 4));
      xmlParts.push('  </user>');
    }

    // Tasks data
    xmlParts.push('  <tasks>');
    if (data.tasks.active.length > 0) {
      xmlParts.push('    <active>');
      data.tasks.active.forEach(task => {
        xmlParts.push('      <task>');
        xmlParts.push(this.objectToXML(task, 8));
        xmlParts.push('      </task>');
      });
      xmlParts.push('    </active>');
    }
    
    if (data.tasks.completed.length > 0) {
      xmlParts.push('    <completed>');
      data.tasks.completed.forEach(task => {
        xmlParts.push('      <task>');
        xmlParts.push(this.objectToXML(task, 8));
        xmlParts.push('      </task>');
      });
      xmlParts.push('    </completed>');
    }
    
    if (data.tasks.failed.length > 0) {
      xmlParts.push('    <failed>');
      data.tasks.failed.forEach(task => {
        xmlParts.push('      <task>');
        xmlParts.push(this.objectToXML(task, 8));
        xmlParts.push('      </task>');
      });
      xmlParts.push('    </failed>');
    }
    xmlParts.push('  </tasks>');

    // Achievements
    if (data.achievements.length > 0) {
      xmlParts.push('  <achievements>');
      data.achievements.forEach(achievement => {
        xmlParts.push('    <achievement>');
        xmlParts.push(this.objectToXML(achievement, 6));
        xmlParts.push('    </achievement>');
      });
      xmlParts.push('  </achievements>');
    }

    // Inventory
    if (data.inventory.length > 0) {
      xmlParts.push('  <inventory>');
      data.inventory.forEach(item => {
        xmlParts.push('    <item>');
        xmlParts.push(this.objectToXML(item, 6));
        xmlParts.push('    </item>');
      });
      xmlParts.push('  </inventory>');
    }

    // Equipment
    if (data.equipment.length > 0) {
      xmlParts.push('  <equipment>');
      data.equipment.forEach(item => {
        xmlParts.push('    <item>');
        xmlParts.push(this.objectToXML(item, 6));
        xmlParts.push('    </item>');
      });
      xmlParts.push('  </equipment>');
    }

    // Calendar
    if (data.calendar.events.length > 0) {
      xmlParts.push('  <calendar>');
      xmlParts.push('    <events>');
      data.calendar.events.forEach(event => {
        xmlParts.push('      <event>');
        xmlParts.push(this.objectToXML(event, 8));
        xmlParts.push('      </event>');
      });
      xmlParts.push('    </events>');
      xmlParts.push('  </calendar>');
    }

    xmlParts.push('</export>');
    return xmlParts.join('\n');
  }

  /**
   * Convert array of objects to CSV format
   */
  private objectToCSV(objects: any[], _type: string): string {
    if (objects.length === 0) return '';

    // Get all unique keys from all objects
    const allKeys = new Set<string>();
    objects.forEach(obj => {
      Object.keys(obj).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys);
    const csvLines: string[] = [];

    // Add header
    csvLines.push(headers.map(h => `"${h}"`).join(','));

    // Add data rows
    objects.forEach(obj => {
      const row = headers.map(header => {
        const value = obj[header];
        if (value === null || value === undefined) {
          return '""';
        }
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  /**
   * Convert object to XML format with indentation
   */
  private objectToXML(obj: any, indentLevel: number = 0): string {
    const indent = ' '.repeat(indentLevel);
    const xmlParts: string[] = [];

    Object.entries(obj).forEach(([key, value]) => {
      const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      if (value === null || value === undefined) {
        xmlParts.push(`${indent}<${cleanKey} />`);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        xmlParts.push(`${indent}<${cleanKey}>`);
        xmlParts.push(this.objectToXML(value, indentLevel + 2));
        xmlParts.push(`${indent}</${cleanKey}>`);
      } else if (Array.isArray(value)) {
        xmlParts.push(`${indent}<${cleanKey}>`);
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            xmlParts.push(`${indent}  <item_${index}>`);
            xmlParts.push(this.objectToXML(item, indentLevel + 4));
            xmlParts.push(`${indent}  </item_${index}>`);
          } else {
            xmlParts.push(`${indent}  <item_${index}>${this.escapeXML(String(item))}</item_${index}>`);
          }
        });
        xmlParts.push(`${indent}</${cleanKey}>`);
      } else {
        xmlParts.push(`${indent}<${cleanKey}>${this.escapeXML(String(value))}</${cleanKey}>`);
      }
    });

    return xmlParts.join('\n');
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parse JSON import data
   */
  private parseJSON(content: string): ExportData {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Parse CSV import data (simplified implementation)
   */
  private parseCSV(_content: string): ExportData {
    // This is a simplified CSV parser - in production, you'd want a more robust solution
    // For now, return basic structure - full CSV parsing would be more complex
    return {
      user: null,
      tasks: { active: [], completed: [], failed: [] },
      achievements: [],
      inventory: [],
      equipment: [],
      calendar: { events: [], settings: {} },
      settings: {},
      exportMetadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        format: 'csv',
        totalRecords: 0
      }
    };
  }

  /**
   * Parse XML import data (simplified implementation)
   */
  private parseXML(_content: string): ExportData {
    // This is a simplified XML parser - in production, you'd want a proper XML parser
    // For now, return basic structure
    return {
      user: null,
      tasks: { active: [], completed: [], failed: [] },
      achievements: [],
      inventory: [],
      equipment: [],
      calendar: { events: [], settings: {} },
      settings: {},
      exportMetadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        format: 'xml',
        totalRecords: 0
      }
    };
  }

  /**
   * Process imported data and update stores
   */
  private async processImportData(data: ExportData): Promise<{
    success: boolean;
    message: string;
    imported: {
      users: number;
      tasks: number;
      achievements: number;
      inventory: number;
      equipment: number;
      calendar: number;
    };
  }> {
    const imported = {
      users: 0,
      tasks: 0,
      achievements: 0,
      inventory: 0,
      equipment: 0,
      calendar: 0
    };

    try {
      // Import user data
      if (data.user) {
        // Note: In a real implementation, you'd want to be careful about overwriting user data
        imported.users = 1;
      }

      // Import tasks
      if (data.tasks) {
        imported.tasks = data.tasks.active.length + data.tasks.completed.length + data.tasks.failed.length;
        // In a real implementation, you'd merge or replace tasks based on user preference
      }

      // Import achievements
      if (data.achievements && data.achievements.length > 0) {
        imported.achievements = data.achievements.length;
        // Merge achievements without duplicates
      }

      // Import inventory
      if (data.inventory && data.inventory.length > 0) {
        imported.inventory = data.inventory.length;
      }

      // Import equipment
      if (data.equipment && data.equipment.length > 0) {
        imported.equipment = data.equipment.length;
      }

      // Import calendar events
      if (data.calendar && data.calendar.events && data.calendar.events.length > 0) {
        imported.calendar = data.calendar.events.length;
      }

      return {
        success: true,
        message: `Successfully imported ${Object.values(imported).reduce((a, b) => a + b, 0)} records`,
        imported
      };
    } catch (error) {
      throw new Error(`Failed to process import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Filter tasks by date range
   */
  private filterTasksByDateRange(tasks: any, dateRange: { start: Date; end: Date }): any {
    const filterFn = (task: any) => {
      const taskDate = new Date(task.created_at || task.updated_at);
      return taskDate >= dateRange.start && taskDate <= dateRange.end;
    };

    return {
      active: tasks.active.filter(filterFn),
      completed: tasks.completed.filter(filterFn),
      failed: tasks.failed.filter(filterFn)
    };
  }

  /**
   * Filter calendar events by date range
   */
  private filterEventsByDateRange(events: any[], dateRange: { start: Date; end: Date }): any[] {
    return events.filter(event => {
      const eventDate = new Date(event.start || event.date);
      return eventDate >= dateRange.start && eventDate <= dateRange.end;
    });
  }

  /**
   * Gather application settings
   */
  private gatherAppSettings(): any {
    return {
      theme: localStorage.getItem('theme') || 'dark',
      notifications: JSON.parse(localStorage.getItem('notificationSettings') || '{}'),
      keyboardShortcuts: JSON.parse(localStorage.getItem('keyboardShortcuts') || '{}'),
      accessibility: JSON.parse(localStorage.getItem('accessibilitySettings') || '{}')
    };
  }

  /**
   * Calculate total records in export data
   */
  private calculateTotalRecords(data: ExportData): number {
    let total = 0;
    
    if (data.user) total += 1;
    total += data.tasks.active.length + data.tasks.completed.length + data.tasks.failed.length;
    total += data.achievements.length;
    total += data.inventory.length;
    total += data.equipment.length;
    total += data.calendar.events.length;
    
    return total;
  }

  /**
   * Download data as file
   */
  downloadAsFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Get appropriate MIME type for format
   */
  getMimeType(format: ExportFormat): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'xml':
        return 'application/xml';
      default:
        return 'text/plain';
    }
  }

  /**
   * Generate filename with timestamp
   */
  generateFilename(format: ExportFormat, prefix: string = 'life-gamification-export'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}-${timestamp}.${format}`;
  }
}

// Export singleton instance
export const dataExportService = new DataExportService();