import axios from 'axios'
import { marked } from 'marked'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'

type Station = {
  icao: string
  name: string
}

type StationsMap = Record<string, Station[]>

type ApiResponse<T = unknown> = {
  success?: boolean
  code?: number
  result?: T
}

type BlogSource = {
  slug: string
  path: string
}

type BlogPost = {
  slug: string
  date: string
  title: string
  description: string
  markdown: string
  html: string
}

const KEY_SEQUENCE = ['GR', 'UK', 'US', 'RS', 'BU', 'CH', 'SP', 'SW', 'FI', 'CA', 'NO']
const BLOG_SOURCES: BlogSource[] = [
  { slug: 'arctic-change', path: '/content/articles/arctic-change.md' },
  { slug: 'greenland-melting', path: '/content/articles/greenland-melting.md' },
  { slug: 'hurricanes', path: '/content/articles/hurricanes.md' },
  { slug: 'november2020', path: '/content/articles/november2020.md' },
  { slug: 'blog-2', path: '/content/articles/examples/blog-2.md' },
  { slug: 'κακοκαιρια-26-ιανουαριου', path: '/content/articles/κακοκαιρια-26-ιανουαριου.md' },
]

const api = axios.create({
  baseURL: '/',
})

function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <h1>Weather React</h1>
        <nav>
          <Link to="/blog/page/1">Blog</Link>
          <Link to="/gfsanalyser">GFS</Link>
          <Link to="/history/day">Day History</Link>
          <Link to="/history/month">Month History</Link>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/blog/page/1" replace />} />
          <Route path="/blog/page/:page" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogArticle />} />
          <Route path="/gfsanalyser" element={<GfsForm />} />
          <Route path="/gfsanalyser/:icao" element={<GfsDetail />} />
          <Route path="/history/day" element={<HistoryDayForm />} />
          <Route path="/history/day/:icao/:month/:day" element={<HistoryDayDetail />} />
          <Route path="/history/month" element={<HistoryMonthForm />} />
          <Route path="/history/month/:icao/:month/:year" element={<HistoryMonthDetail />} />
          <Route path="*" element={<Navigate to="/blog/page/1" replace />} />
        </Routes>
      </main>
    </div>
  )
}

async function loadBlogPost(source: BlogSource): Promise<BlogPost | null> {
  try {
    const response = await fetch(source.path)
    if (!response.ok) {
      return null
    }

    const markdown = await response.text()
    const { frontMatter, body } = splitMarkdown(markdown)

    return {
      slug: source.slug,
      date: readField(frontMatter, 'date') ?? '1970-01-01',
      title: readField(frontMatter, 'title') ?? source.slug,
      description: readField(frontMatter, 'description') ?? '',
      markdown: body,
      html: await marked.parse(body),
    }
  } catch {
    return null
  }
}

function splitMarkdown(markdown: string): { frontMatter: string; body: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { frontMatter: '', body: markdown }
  }

  return { frontMatter: match[1], body: match[2] }
}

function readField(frontMatter: string, key: string): string | null {
  const match = frontMatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  if (!match?.[1]) {
    return null
  }

  return match[1].replace(/^"|"$/g, '').trim()
}

function useStations() {
  const [stations, setStations] = useState<StationsMap>({})

  useEffect(() => {
    const run = async () => {
      const { data } = await api.get<ApiResponse<StationsMap>>('/api/v1/stations')
      if (data.success && data.code === 200) {
        setStations(data.result ?? {})
      }
    }

    void run()
  }, [])

  return { stations }
}

function BlogPage() {
  const { page = '1' } = useParams()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const result = await Promise.all(BLOG_SOURCES.map((source) => loadBlogPost(source)))
      const filtered = result
        .filter((item): item is BlogPost => Boolean(item))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      setPosts(filtered)
      setLoading(false)
    }

    void run()
  }, [])

  const pageNo = Number(page) > 0 ? Number(page) : 1
  const slice = posts.slice((pageNo - 1) * 4, (pageNo - 1) * 4 + 4)

  return (
    <section className="card">
      <h2>Blog Page {pageNo}</h2>
      {loading && <p>Loading articles...</p>}
      {!loading && (
        <ul>
          {slice.map((post) => (
            <li key={post.slug}>
              <Link to={`/blog/${post.slug}`}>{post.title}</Link>
              <div className="meta">
                {post.date} - {post.description}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function BlogArticle() {
  const { slug = '' } = useParams()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const normalizedSlug = decodeURIComponent(slug)
      const source = BLOG_SOURCES.find((item) => item.slug === normalizedSlug)
      if (!source) {
        setPost(null)
        setLoading(false)
        return
      }

      setPost(await loadBlogPost(source))
      setLoading(false)
    }

    void run()
  }, [slug])

  return (
    <section className="card">
      <h2>{post?.title ?? `Article: ${slug}`}</h2>
      {post?.date && <p className="meta">{post.date}</p>}
      {loading && <p>Loading article...</p>}
      {!loading && !post && <p>Article not found.</p>}
      {post && <article dangerouslySetInnerHTML={{ __html: post.html }} />}
      <Link to="/blog/page/1">Back to blog</Link>
    </section>
  )
}

function GfsForm() {
  const navigate = useNavigate()
  const { stations } = useStations()
  const [icao, setIcao] = useState('')

  return (
    <section className="card">
      <h2>GFS Analyser</h2>
      <select value={icao} onChange={(e) => setIcao(e.target.value)}>
        <option value="">Select station</option>
        {KEY_SEQUENCE.map((key) => (
          <optgroup label={key} key={key}>
            {(stations[key] ?? []).map((station) => (
              <option key={station.icao} value={station.icao}>
                {station.name} ({station.icao})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button type="button" onClick={() => icao && navigate(`/gfsanalyser/${icao}`)}>
        View Forecast
      </button>
    </section>
  )
}

function GfsDetail() {
  const { icao = '' } = useParams()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await api.get<ApiResponse<Record<string, unknown> | Array<Record<string, unknown>>>>(
          `/api/v1/rainCalculator?icao=${encodeURIComponent(icao)}`,
        )

        if (Array.isArray(data.result)) {
          setRows(data.result)
          return
        }

        const normalized = Object.entries(data.result ?? {}).map(([key, value]) => ({
          ...(value as Record<string, unknown>),
          timeLabel: key,
        }))
        setRows(normalized)
      } catch {
        setError('Failed to load rainCalculator data.')
      }
    }

    void run()
  }, [icao])

  return (
    <section className="card">
      <h2>GFS Details: {icao}</h2>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>AvgTemp2</th>
            <th>AvgPrecip</th>
            <th>AvgPressure</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((row, index) => (
            <tr key={String(row.timeLabel ?? index)}>
              <td>{String(row.timeLabel ?? '-')}</td>
              <td>{String(row.avgTemp2 ?? '-')}</td>
              <td>{String(row.avgPrecip ?? '-')}</td>
              <td>{String(row.avgPressure ?? '-')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function HistoryDayForm() {
  const navigate = useNavigate()
  const { stations } = useStations()
  const [icao, setIcao] = useState('')
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)

  return (
    <section className="card">
      <h2>History by Day</h2>
      <select value={icao} onChange={(e) => setIcao(e.target.value)}>
        <option value="">Select station</option>
        {KEY_SEQUENCE.map((key) => (
          <optgroup label={key} key={key}>
            {(stations[key] ?? []).map((station) => (
              <option key={station.icao} value={station.icao}>
                {station.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
      <input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value))} />
      <button
        type="button"
        onClick={() =>
          icao &&
          navigate(`/history/day/${icao}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`)
        }
      >
        Show Day History
      </button>
    </section>
  )
}

function HistoryDayDetail() {
  const { icao = '', month = '', day = '' } = useParams()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    const run = async () => {
      const [first, second] = await Promise.all([
        api.get<ApiResponse<Array<Record<string, unknown>>>>(
          `/api/v1/weatherdata?icao=${encodeURIComponent(icao)}&day=${day}&month=${month}`,
        ),
        api.get<ApiResponse<Record<string, unknown>>>(
          `/api/v1/weatherdata?icao=${encodeURIComponent(icao)}&startYear=1981&endYear=2019&day=${day}&month=${month}`,
        ),
      ])

      setRows(first.data.result ?? [])
      setSummary(second.data.result ?? null)
    }

    void run()
  }, [icao, day, month])

  return (
    <section className="card">
      <h2>
        Day History: {icao}/{month}/{day}
      </h2>
      {summary && (
        <div className="stats">
          <p>Avg max temp: {String(summary.avgMaxTemp ?? '-')}</p>
          <p>Avg mean temp: {String(summary.avgMeanTemp ?? '-')}</p>
          <p>Avg min temp: {String(summary.avgMinTemp ?? '-')}</p>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Max</th>
            <th>Mean</th>
            <th>Min</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.iDate ?? i)}>
              <td>{String(row.iDate ?? row.year ?? '-')}</td>
              <td>{String(row.maxTemp ?? '-')}</td>
              <td>{String(row.meanTemp ?? '-')}</td>
              <td>{String(row.minTemp ?? '-')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function HistoryMonthForm() {
  const navigate = useNavigate()
  const { stations } = useStations()
  const [icao, setIcao] = useState('')
  const [month, setMonth] = useState(1)
  const [year, setYear] = useState(2021)

  return (
    <section className="card">
      <h2>History by Month</h2>
      <select value={icao} onChange={(e) => setIcao(e.target.value)}>
        <option value="">Select station</option>
        {KEY_SEQUENCE.map((key) => (
          <optgroup label={key} key={key}>
            {(stations[key] ?? []).map((station) => (
              <option key={station.icao} value={station.icao}>
                {station.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
      <input type="number" min={1981} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
      <button
        type="button"
        onClick={() => icao && navigate(`/history/month/${icao}/${String(month).padStart(2, '0')}/${year}`)}
      >
        Show Month History
      </button>
    </section>
  )
}

function HistoryMonthDetail() {
  const { icao = '', month = '', year = '' } = useParams()
  const [series, setSeries] = useState<Array<Record<string, unknown>>>([])
  const [targetMonth, setTargetMonth] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    const run = async () => {
      const [trend, monthData] = await Promise.all([
        api.get<ApiResponse<Array<Record<string, unknown>>>>(
          `/api/v1/weatherdata?icao=${encodeURIComponent(icao)}&startYear=1981&endYear=2021&month=${month}`,
        ),
        api.get<ApiResponse<Record<string, unknown>>>(
          `/api/v1/weatherdata?icao=${encodeURIComponent(icao)}&month=${month}&year=${year}`,
        ),
      ])

      setSeries(trend.data.result ?? [])
      setTargetMonth(monthData.data.result ?? null)
    }

    void run()
  }, [icao, month, year])

  const lastThirty = useMemo(() => series.slice(Math.max(series.length - 30, 0)), [series])
  const avg = (key: string) => {
    const values = lastThirty.map((row) => Number(row[key])).filter((v) => Number.isFinite(v))
    if (!values.length) return '-'
    return (values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(2)
  }

  const chartData = series.map((item) => ({
    year: Number(item.year ?? 0),
    avgMeanTemp: Number(item.avgMeanTemp ?? 0),
  }))

  return (
    <section className="card">
      <h2>
        Month History: {icao}/{month}/{year}
      </h2>
      {targetMonth && (
        <div className="stats">
          <p>Month avg max: {String(targetMonth.avgMaxTemp ?? '-')}</p>
          <p>Month avg mean: {String(targetMonth.avgMeanTemp ?? '-')}</p>
          <p>Month avg min: {String(targetMonth.avgMinTemp ?? '-')}</p>
          <p>30y avg max: {avg('avgMaxTemp')}</p>
          <p>30y avg mean: {avg('avgMeanTemp')}</p>
          <p>30y avg min: {avg('avgMinTemp')}</p>
        </div>
      )}

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="avgMeanTemp" stroke="#1f4f77" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default App
