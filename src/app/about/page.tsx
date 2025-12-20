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
        <h2 className="font-semibold mb-3">Contribute</h2>
        <div className="space-y-3 text-sm text-zinc-400">
          <p>
            VisualTango is written and managed by Toby Balsley. This is an open
            project and <strong className="text-zinc-200">contributions are welcome!</strong>
          </p>
          <p>
            If you&apos;re interested in helping with MIDI transcriptions, sync point
            editing, visual design, or development, please reach out.
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="font-semibold mb-3">Contact</h2>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-4">
            <Link
              href="https://www.facebook.com/tangotiempo"
              target="_blank"
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </Link>
            <Link
              href="https://www.instagram.com/tangotiempo"
              target="_blank"
              className="flex items-center gap-2 text-pink-400 hover:text-pink-300"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </Link>
          </div>
          <p className="text-zinc-500">
            Or reach out via{' '}
            <Link
              href="https://hdtsllc.com"
              target="_blank"
              className="text-blue-400 hover:text-blue-300"
            >
              HDTS LLC
            </Link>
            {' '}for professional inquiries.
          </p>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-600 pt-4">
        VisualTango v1.0.1
      </div>
    </div>
  );
}
