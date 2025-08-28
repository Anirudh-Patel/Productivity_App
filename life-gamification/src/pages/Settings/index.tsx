import { Settings as SettingsIcon } from 'lucide-react'

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">Customize your experience</p>
      </div>

      <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
        <div className="text-center py-12 text-gray-400">
          <SettingsIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Settings coming soon!</p>
          <p className="text-sm mt-2">Theme options and preferences will be available here</p>
        </div>
      </div>
    </div>
  )
}

export default Settings