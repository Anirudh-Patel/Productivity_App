import { useState, useRef } from 'react'
import { X, Download, Upload, FileText, Database, Calendar, Settings, User, Trophy, Package, Shield, CheckCircle, AlertTriangle } from 'lucide-react'
import { dataExportService, ExportOptions, ExportFormat } from '../../../services/dataExportService'
import { useToast } from './Toast'
import { FadeIn } from './AnimatedComponents'

interface DataExportModalProps {
  isOpen: boolean
  onClose: () => void
}

const DataExportModal = ({ isOpen, onClose }: DataExportModalProps) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeUser: true,
    includeTasks: true,
    includeAchievements: true,
    includeInventory: true,
    includeEquipment: true,
    includeCalendar: true,
    includeSettings: true
  })
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importFormat, setImportFormat] = useState<ExportFormat>('json')
  const [importResult, setImportResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  if (!isOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const content = await dataExportService.exportData(exportOptions)
      const filename = dataExportService.generateFilename(exportOptions.format)
      const mimeType = dataExportService.getMimeType(exportOptions.format)
      
      dataExportService.downloadAsFile(content, filename, mimeType)
      
      toast.success('Export Complete! 📦', `Data exported successfully as ${filename}`)
      onClose()
    } catch (error) {
      toast.error('Export Failed', error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportResult(null)

    try {
      const content = await file.text()
      const result = await dataExportService.importData(content, importFormat)
      
      setImportResult(result)
      
      if (result.success) {
        toast.success('Import Complete! 🎉', result.message)
      } else {
        toast.error('Import Failed', result.message)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setImportResult({
        success: false,
        message: errorMessage,
        imported: { users: 0, tasks: 0, achievements: 0, inventory: 0, equipment: 0, calendar: 0 }
      })
      toast.error('Import Failed', errorMessage)
    } finally {
      setIsImporting(false)
    }
  }

  const formatOptions = [
    { value: 'json' as ExportFormat, label: 'JSON', description: 'Best for full data backup and restore', icon: FileText },
    { value: 'csv' as ExportFormat, label: 'CSV', description: 'Great for spreadsheet analysis', icon: Database },
    { value: 'xml' as ExportFormat, label: 'XML', description: 'Structured format for data exchange', icon: FileText }
  ]

  const dataCategories = [
    { key: 'includeUser', label: 'User Profile', description: 'Your level, XP, stats, and progress', icon: User },
    { key: 'includeTasks', label: 'Tasks & Quests', description: 'All active, completed, and failed tasks', icon: CheckCircle },
    { key: 'includeAchievements', label: 'Achievements', description: 'Unlocked achievements and progress', icon: Trophy },
    { key: 'includeInventory', label: 'Inventory', description: 'Items, potions, and collectibles', icon: Package },
    { key: 'includeEquipment', label: 'Equipment', description: 'Equipped items and gear', icon: Shield },
    { key: 'includeCalendar', label: 'Calendar Data', description: 'Events and calendar settings', icon: Calendar },
    { key: 'includeSettings', label: 'App Settings', description: 'Preferences and configurations', icon: Settings }
  ]

  const getTotalSelectedRecords = () => {
    return Object.entries(exportOptions).filter(([key, value]) => 
      key.startsWith('include') && value === true
    ).length
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <FadeIn>
        <div className="bg-theme-primary rounded-lg border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gradient-to-r from-theme-primary to-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-theme-accent/20 rounded-lg">
                <Database className="w-6 h-6 text-theme-accent" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Data Management</h2>
                <p className="text-sm text-gray-400">Export and import your gamification data</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex h-full max-h-[calc(90vh-120px)]">
            {/* Tab Navigation */}
            <div className="w-48 bg-theme-bg border-r border-gray-800 p-4">
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('export')}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${
                    activeTab === 'export'
                      ? 'bg-theme-accent/20 text-theme-accent'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Export Data
                </button>
                <button
                  onClick={() => setActiveTab('import')}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${
                    activeTab === 'import'
                      ? 'bg-theme-accent/20 text-theme-accent'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Import Data
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'export' ? (
                <div className="space-y-6">
                  {/* Format Selection */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Choose Export Format</h3>
                    <div className="grid gap-4">
                      {formatOptions.map(({ value, label, description, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setExportOptions(prev => ({ ...prev, format: value }))}
                          className={`text-left p-4 rounded-lg border transition-colors ${
                            exportOptions.format === value
                              ? 'border-theme-accent bg-theme-accent/10'
                              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-5 h-5 ${
                              exportOptions.format === value ? 'text-theme-accent' : 'text-gray-400'
                            }`} />
                            <div>
                              <div className="font-medium">{label}</div>
                              <div className="text-sm text-gray-400">{description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data Categories */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Select Data to Export</h3>
                    <div className="space-y-3">
                      {dataCategories.map(({ key, label, description, icon: Icon }) => (
                        <label
                          key={key}
                          className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800/70 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={exportOptions[key as keyof ExportOptions] as boolean}
                            onChange={(e) => setExportOptions(prev => ({
                              ...prev,
                              [key]: e.target.checked
                            }))}
                            className="mt-1 rounded border-gray-600 bg-gray-700 text-theme-accent focus:ring-theme-accent"
                          />
                          <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium">{label}</div>
                            <div className="text-sm text-gray-400">{description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Export Summary */}
                  <div className="bg-theme-accent/10 border border-theme-accent/30 rounded-lg p-4">
                    <h4 className="font-medium text-theme-accent mb-2">Export Summary</h4>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>Format: <span className="font-mono bg-gray-800 px-2 py-0.5 rounded">{exportOptions.format.toUpperCase()}</span></div>
                      <div>Categories: {getTotalSelectedRecords()} selected</div>
                      <div>Timestamp: {new Date().toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={handleExport}
                    disabled={isExporting || getTotalSelectedRecords() === 0}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      isExporting || getTotalSelectedRecords() === 0
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-theme-accent text-white hover:bg-theme-accent/90'
                    }`}
                  >
                    {isExporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Export Data ({getTotalSelectedRecords()} categories)
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Import Format */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Import Format</h3>
                    <div className="grid gap-4">
                      {formatOptions.map(({ value, label, description, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setImportFormat(value)}
                          className={`text-left p-4 rounded-lg border transition-colors ${
                            importFormat === value
                              ? 'border-theme-accent bg-theme-accent/10'
                              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-5 h-5 ${
                              importFormat === value ? 'text-theme-accent' : 'text-gray-400'
                            }`} />
                            <div>
                              <div className="font-medium">{label}</div>
                              <div className="text-sm text-gray-400">{description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* File Upload */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Select File to Import</h3>
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-medium mb-2">Choose a file to import</p>
                      <p className="text-gray-400 mb-4">
                        Select a {importFormat.toUpperCase()} file exported from Life Gamification App
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={importFormat === 'json' ? '.json' : importFormat === 'csv' ? '.csv' : '.xml'}
                        onChange={handleImportFile}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                          isImporting
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-theme-accent text-white hover:bg-theme-accent/90'
                        }`}
                      >
                        {isImporting ? (
                          <>
                            <div className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          'Choose File'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Import Results */}
                  {importResult && (
                    <div className={`border rounded-lg p-4 ${
                      importResult.success
                        ? 'border-green-500/30 bg-green-500/10'
                        : 'border-red-500/30 bg-red-500/10'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        {importResult.success ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        )}
                        <h4 className={`font-medium ${
                          importResult.success ? 'text-green-400' : 'text-red-400'
                        }`}>
                          Import {importResult.success ? 'Successful' : 'Failed'}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-300 mb-3">{importResult.message}</p>
                      
                      {importResult.success && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <div>Users: {importResult.imported.users}</div>
                            <div>Tasks: {importResult.imported.tasks}</div>
                            <div>Achievements: {importResult.imported.achievements}</div>
                          </div>
                          <div className="space-y-1">
                            <div>Inventory: {importResult.imported.inventory}</div>
                            <div>Equipment: {importResult.imported.equipment}</div>
                            <div>Calendar: {importResult.imported.calendar}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Import Warning */}
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-orange-400 mb-1">Important Notice</h4>
                        <p className="text-sm text-gray-300">
                          Importing data will merge with your existing data. Some duplicate entries may be created. 
                          It's recommended to export your current data as a backup before importing.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}

export default DataExportModal