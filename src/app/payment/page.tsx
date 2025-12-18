export default function PaymentPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold mb-2">Subscription Plans</h1>
        <p className="text-zinc-400">Choose the plan that works for you</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Free Tier */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="font-semibold text-lg mb-2">Free</h2>
          <p className="text-3xl font-bold mb-4">
            $0<span className="text-sm text-zinc-500">/month</span>
          </p>
          <ul className="text-zinc-400 text-sm space-y-2 mb-6">
            <li>✓ View catalog</li>
            <li>✓ Limited playback</li>
            <li className="text-zinc-600">✗ Full playback</li>
            <li className="text-zinc-600">✗ Editor access</li>
          </ul>
          <button
            disabled
            className="w-full py-2 bg-zinc-700 text-zinc-500 rounded-lg cursor-not-allowed"
          >
            Coming Soon
          </button>
        </div>

        {/* Subscriber Tier */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-blue-600">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-semibold text-lg">Subscriber</h2>
            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
              Popular
            </span>
          </div>
          <p className="text-3xl font-bold mb-4">
            $5<span className="text-sm text-zinc-500">/month</span>
          </p>
          <ul className="text-zinc-400 text-sm space-y-2 mb-6">
            <li>✓ View catalog</li>
            <li>✓ Full playback</li>
            <li>✓ All visualizations</li>
            <li className="text-zinc-600">✗ Editor access</li>
          </ul>
          <button
            disabled
            className="w-full py-2 bg-zinc-700 text-zinc-500 rounded-lg cursor-not-allowed"
          >
            Coming Soon
          </button>
        </div>

        {/* Editor Tier */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="font-semibold text-lg mb-2">Editor</h2>
          <p className="text-3xl font-bold mb-4">
            $15<span className="text-sm text-zinc-500">/month</span>
          </p>
          <ul className="text-zinc-400 text-sm space-y-2 mb-6">
            <li>✓ Everything in Subscriber</li>
            <li>✓ Sync point editor</li>
            <li>✓ Adornment tools</li>
            <li>✓ Export configurations</li>
          </ul>
          <button
            disabled
            className="w-full py-2 bg-zinc-700 text-zinc-500 rounded-lg cursor-not-allowed"
          >
            Coming Soon
          </button>
        </div>
      </div>

      <div className="bg-amber-900/30 border border-amber-800 rounded-lg p-4">
        <p className="text-amber-200 text-sm">
          <strong>Note:</strong> Payment integration is not yet implemented.
          Currently all users have Editor access for testing.
        </p>
      </div>

      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="font-semibold mb-3">Role Permissions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="py-2">Feature</th>
              <th className="py-2 text-center">Guest</th>
              <th className="py-2 text-center">Free</th>
              <th className="py-2 text-center">Subscriber</th>
              <th className="py-2 text-center">Editor</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-b border-zinc-800/50">
              <td className="py-2">View Catalog</td>
              <td className="py-2 text-center text-green-400">✓</td>
              <td className="py-2 text-center text-green-400">✓</td>
              <td className="py-2 text-center text-green-400">✓</td>
              <td className="py-2 text-center text-green-400">✓</td>
            </tr>
            <tr className="border-b border-zinc-800/50">
              <td className="py-2">Play Songs</td>
              <td className="py-2 text-center text-zinc-600">—</td>
              <td className="py-2 text-center text-amber-400">Limited</td>
              <td className="py-2 text-center text-green-400">✓</td>
              <td className="py-2 text-center text-green-400">✓</td>
            </tr>
            <tr className="border-b border-zinc-800/50">
              <td className="py-2">Edit Sync Points</td>
              <td className="py-2 text-center text-zinc-600">—</td>
              <td className="py-2 text-center text-zinc-600">—</td>
              <td className="py-2 text-center text-zinc-600">—</td>
              <td className="py-2 text-center text-green-400">✓</td>
            </tr>
            <tr>
              <td className="py-2">Add Adornments</td>
              <td className="py-2 text-center text-zinc-600">—</td>
              <td className="py-2 text-center text-zinc-600">—</td>
              <td className="py-2 text-center text-zinc-600">—</td>
              <td className="py-2 text-center text-green-400">✓</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
