export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold mb-2">About VisualTango</h1>
        <p className="text-zinc-400">See the music</p>
      </div>

      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 space-y-4">
        <p className="text-zinc-300">
          VisualTango creates animated visual music scores synced to classic
          1930s Argentine tango recordings.
        </p>

        <p className="text-zinc-400">
          Inspired by Stephen Malinowski&apos;s Music Animation Machine, we make
          the invisible structure of tango music visible - showing the interplay
          between bandoneon, strings, piano, and vocals.
        </p>
      </div>

      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="font-semibold mb-3">How It Works</h2>
        <ul className="text-zinc-400 space-y-2 text-sm">
          <li>
            <strong className="text-zinc-200">MIDI from sheet music</strong> -
            Perfect, quantized note timing
          </li>
          <li>
            <strong className="text-zinc-200">Audio from recordings</strong> -
            Human performance with rubato
          </li>
          <li>
            <strong className="text-zinc-200">Sync points</strong> - Manually
            aligned markers between MIDI and audio
          </li>
          <li>
            <strong className="text-zinc-200">Interpolation</strong> - Smooth
            visual sync even when tempos vary
          </li>
        </ul>
      </div>

      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="font-semibold mb-3">Links</h2>
        <div className="space-y-2 text-sm">
          <p className="text-zinc-500">(Coming soon)</p>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="font-semibold mb-3">Contact</h2>
        <div className="space-y-2 text-sm">
          <p className="text-zinc-500">(Coming soon)</p>
        </div>
      </div>
    </div>
  );
}
