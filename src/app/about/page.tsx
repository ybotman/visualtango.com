import Link from 'next/link';

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
        <h2 className="font-semibold mb-3">About the Creator</h2>
        <div className="space-y-4 text-sm text-zinc-400">
          <p>
            <strong className="text-zinc-200">Toby Balsley</strong> is a Boston-based
            Argentine tango dancer, teacher, and technologist. He started tango at
            Ultimate Tango with Hernan Brizuela and Anita Flejter, bringing years of
            prior dance experience in Latin, ballroom, country 2-step, and West Coast Swing.
          </p>

          <p>
            A milonguero who travels the world for tango with his wife Wailing, Toby
            combines a deep passion for tango with a professional background in technology.
            While working as a computer and data consultant by day, he has a rich musical
            background in singing, choral conducting, music theory, and vocal composition.
          </p>

          <p>
            Toby is fascinated by the many layers of music and dance that Argentine tango
            provides, which led to the creation of VisualTango - a tool to help dancers
            see and understand the musical structure that drives tango movement.
          </p>

          <p className="text-zinc-500">
            Tango mentors: Gustavo Naveira, Chicho Frumboli, Alejandra Mantinan, Hernan Brizuela
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="font-semibold mb-3">Other Projects</h2>
        <div className="space-y-3 text-sm">
          <div>
            <Link
              href="https://tangotiempo.com"
              target="_blank"
              className="text-blue-400 hover:text-blue-300"
            >
              TangoTiempo.com
            </Link>
            <p className="text-zinc-500">Argentine Tango calendar and event listings</p>
          </div>
          <div>
            <Link
              href="https://bostontangocalendar.com"
              target="_blank"
              className="text-blue-400 hover:text-blue-300"
            >
              Boston Tango Calendar
            </Link>
            <p className="text-zinc-500">Local Boston tango community resource</p>
          </div>
          <div>
            <Link
              href="https://tobytango.com"
              target="_blank"
              className="text-blue-400 hover:text-blue-300"
            >
              TobyTango.com
            </Link>
            <p className="text-zinc-500">Interactive Tango Rhythm &amp; Musicality</p>
          </div>
          <div>
            <Link
              href="https://hdtsllc.com"
              target="_blank"
              className="text-blue-400 hover:text-blue-300"
            >
              HDTS LLC
            </Link>
            <p className="text-zinc-500">AI consulting and application development</p>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="font-semibold mb-3">Contact</h2>
        <div className="space-y-2 text-sm">
          <p className="text-zinc-400">
            For questions, feedback, or collaboration inquiries, reach out via{' '}
            <Link
              href="https://hdtsllc.com"
              target="_blank"
              className="text-blue-400 hover:text-blue-300"
            >
              HDTS LLC
            </Link>
          </p>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-600 pt-4">
        VisualTango v1.0.1
      </div>
    </div>
  );
}
