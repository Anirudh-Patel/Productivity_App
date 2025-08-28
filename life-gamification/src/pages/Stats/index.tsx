import { BarChart3 } from 'lucide-react'

const Stats = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Statistics</h1>
        <p className="text-gray-400">Analyze your progress and performance</p>
      </div>

      <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
        <div className="text-center py-12 text-gray-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No statistics available yet</p>
          <p className="text-sm mt-2">Complete quests to see your progress!</p>
        </div>
      </div>
    </div>
  )
}

export default Stats