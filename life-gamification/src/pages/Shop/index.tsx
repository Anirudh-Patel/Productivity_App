import { ShoppingBag } from 'lucide-react'

const Shop = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Shop</h1>
        <p className="text-gray-400">Spend your hard-earned rewards</p>
      </div>

      <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
        <div className="text-center py-12 text-gray-400">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Shop is coming soon!</p>
          <p className="text-sm mt-2">Earn gold and gems to unlock rewards</p>
        </div>
      </div>
    </div>
  )
}

export default Shop