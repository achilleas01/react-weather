import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import axios from 'axios'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

type Station = {
  icao: string
  city?: string
  country?: string
  stationName?: string
}

type RainResponse = {
  sumRainYear: number
  rainDaysYear: number
  sumRainMonth: number
  rainDaysMonth: number
  sumRainMonthDays: number
  rainDaysMonthDays: number
  typeCode?: string
}

type WeatherDay = {
  date: string
  maxTemp: number
  minTemp: number
  meanTemp?: number
  totalRain?: number
}

type WeatherMonth = {
  year: number
  month: number
  avgMaxTemp?: number
  avgMeanTemp?: number
  avgMinTemp?: number
}

type BlogPost = {
  slug: string
  title: string
  date: string
  description: string
  tags: string[]
  markdown: string
  html: string
}

const CONTENT_INDEX: Array<{ slug: string; path: string }> = [
  { slug: 'arctic-change', path: '/content/articles/arctic-change.md' },
  { slug: 'greenland-melting', path: '/content/articles/greenland-melting.md' },
  { slug: 'hurricanes', path: '/content/articles/hurricanes.md' },
  { slug: 'november2020', path: '/content/articles/november2020.md' },
  { slug: 'κακοκαιρια-26-ιανουαριου', path: '/content/articles/κακοκαιρια-26-ιανουαριου.md' },
  { slug: 'example-blog-2', path: '/content/articles/examples/blog-2.md' },
]

function splitMarkdown(source: string): { frontMatter: string; body: string } {
  if (!source.startsWith('---')) {
    return { frontMatter: '', body: source }
  }

  const parts = source.split('---')
  if (parts.length < 3) {
    return { frontMatter: '', body: source }
  }

  return {
    frontMatter: parts[1] ?? '',
    body: parts.slice(2).join('---').trim(),
  }
}

function readField(frontMatter: string, key: string): string | null {
  const regex = new RegExp(`(?:^|\\n)${key}:\\s*(.+)`, 'i')
  const match = frontMatter.match(regex)
  if (!match?.[1]) {
    return null
  }

  return match[1].trim().replace(/^"|"$/g, '')
}

function readListField(frontMatter: string, key: string): string[] {
  const regex = new RegExp(`(?:^|\\n)${key}:\\n((?:\\s*-\\s*.+\\n?)*)`, 'im')
  const block = frontMatter.match(regex)?.[1]
  if (!block) {
    return []
  }

  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.substring(2).trim())
    .filter(Boolean)
}

async function loadBlogPost(path: string, slug: string): Promise<BlogPost> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Cannot load article ${slug}`)
  }

  const source = await response.text()
  const { frontMatter, body } = splitMarkdown(source)

  return {
    slug,
    title: readField(frontMatter, 'title') ?? slug,
    date: readField(frontMatter, 'date') ?? '1970-01-01',
    description: readField(frontMatter, 'description') ?? '',
    tags: readListField(frontMatter, 'tags'),
    markdown: body,
    html: marked.parse(body) as string,
  }
}

async function loadAllBlogPosts(): Promise<BlogPost[]> {
  const loaded = await Promise.all(CONTENT_INDEX.map((entry) => loadBlogPost(entry.path, entry.slug)))
  return loaded.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <h1>Nuxt Weather Rebuild (React)</h1>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/gfsanalyser">GFS Analyser</Link>
            <Link to="/history/day">Day History</Link>
            <Link to="/history/month">Month History</Link>
            <Link to="/blog/page/1">Blog</Link>
          </nav>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/gfsanalyser" element={<GfsLandingPage />} />
            <Route path="/gfsanalyser/:icao" element={<GfsAnalyserPage />} />
            <Route path="/history/day" element={<HistoryDayLanding />} />
            <Route path="/history/day/:icao/:month/:day" element={<HistoryDayPage />} />
            <Route path="/history/month" element={<HistoryMonthLanding />} />
            <Route path="/history/month/:icao/:month/:year" element={<HistoryMonthPage />} />
            <Route path="/blog" element={<Navigate to="/blog/page/1" replace />} />
            <Route path="/blog/page/:page" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogArticle />} />
            <Route path="/tag/:slug" element={<BlogPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

function HomePage() {
  return (
    <section className="card">
      <h2>Weather Dashboard</h2>
      <p>React port of your Nuxt weather project with matching backend contract.</p>
    </section>
  )
}

function GfsLandingPage() {
  const [stations, setStations] = useState<Station[]>([])

  useEffect(() => {
    let mounted = true
    axios
      .get<Station[]>('/api/v1/stations')
      .then((res) => {
        if (mounted) {
          setStations(res.data ?? [])
        }
      })
      .catch(() => {
        if (mounted) {
          setStations([])
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="card">
      <h2>GFS Analyser</h2>
      <ul>
        {stations.map((station) => (
          <li key={station.icao}>
            <Link to={`/gfsanalyser/${station.icao}`}>{station.icao}</Link>
            <span className="muted"> {station.stationName ?? station.city ?? station.country ?? ''}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function GfsAnalyserPage() {
  const { icao = '' } = useParams()
  const [rain, setRain] = useState<RainResponse | null>(null)

  useEffect(() => {
    if (!icao) {
      return
    }

    let mounted = true
    axios
      .get<RainResponse>('/api/v1/rainCalculator', { params: { icao } })
      .then((res) => {
        if (mounted) {
          setRain(res.data)
        }
      })
      .catch(() => {
        if (mounted) {
          setRain(null)
        }
      })

    return () => {
      mounted = false
    }
  }, [icao])

  const chartData = useMemo(() => {
    if (!rain) {
      return []
    }

    return [
      { name: 'Year rain', value: Number(rain.sumRainYear ?? 0) },
      { name: 'Month rain', value: Number(rain.sumRainMonth ?? 0) },
      { name: 'Recent rain', value: Number(rain.sumRainMonthDays ?? 0) },
    ]
  }, [rain])

  return (
    <section className="card">
      <h2>GFS: {icao}</h2>
      {!rain && <p>Loading rain indicators...</p>}
      {rain && (
        <>
          <div className="stats">
            <p>Year rain: {rain.sumRainYear}</p>
            <p>Year rain days: {rain.rainDaysYear}</p>
            <p>Month rain: {rain.sumRainMonth}</p>
            <p>Month rain days: {rain.rainDaysMonth}</p>
            <p>Recent rain: {rain.sumRainMonthDays}</p>
            <p>Recent rain days: {rain.rainDaysMonthDays}</p>
          </div>

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#1f4f77" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  )
}

function HistoryDayLanding() {
  const [stations, setStations] = useState<Station[]>([])

  useEffect(() => {
    let mounted = true
    axios
      .get<Station[]>('/api/v1/stations')
      .then((res) => {
        if (mounted) {
          setStations(res.data ?? [])
        }
      })
      .catch(() => {
        if (mounted) {
          setStations([])
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="card">
      <h2>Daily History Entry</h2>
      <p>Select a station and use URL format: /history/day/&lt;icao&gt;/&lt;month&gt;/&lt;day&gt;</p>
      <ul>
        {stations.map((station) => (
          <li key={station.icao}>{station.icao}</li>
        ))}
      </ul>
    </section>
  )
}

function HistoryDayPage() {
  const { icao = '', month = '', day = '' } = useParams()
  const [rows, setRows] = useState<WeatherDay[]>([])

  useEffect(() => {
    if (!icao || !month || !day) {
      return
    }

    let mounted = true
    axios
      .get<WeatherDay[]>('/api/v1/weatherdata', {
        params: { icao, month, day },
      })
      .then((res) => {
        if (mounted) {
          setRows(res.data ?? [])
        }
      })
      .catch(() => {
        if (mounted) {
          setRows([])
        }
      })

    return () => {
      mounted = false
    }
  }, [icao, month, day])

  const targetDay = rows.find((row) => String(row.date).endsWith(`-${day.padStart(2, '0')}`))
  const chartData = rows.map((row) => ({
    month: String(row.date).slice(5, 7),
    maxTemp: Number(row.maxTemp ?? 0),
    minTemp: Number(row.minTemp ?? 0),
  }))

  return (
    <section className="card">
      <h2>
        Day History: {icao}/{month}/{day}
      </h2>
      {targetDay && (
        <div className="stats">
          <p>Max temp: {String(targetDay.maxTemp ?? '-')}</p>
          <p>Min temp: {String(targetDay.minTemp ?? '-')}</p>
          <p>Mean temp: {String(targetDay.meanTemp ?? '-')}</p>
          <p>Total rain: {String(targetDay.totalRain ?? '-')}</p>
        </div>
      )}

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="maxTemp" stroke="#cc4f4f" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="minTemp" stroke="#1f4f77" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function HistoryMonthLanding() {
  const [stations, setStations] = useState<Station[]>([])

  useEffect(() => {
    let mounted = true
    axios
      .get<Station[]>('/api/v1/stations')
      .then((res) => {
        if (mounted) {
          setStations(res.data ?? [])
        }
      })
      .catch(() => {
        if (mounted) {
          setStations([])
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="card">
      <h2>Monthly History Entry</h2>
      <p>Select a station and use URL format: /history/month/&lt;icao&gt;/&lt;month&gt;/&lt;year&gt;</p>
      <ul>
        {stations.map((station) => (
          <li key={station.icao}>{station.icao}</li>
        ))}
      </ul>
    </section>
  )
}

function HistoryMonthPage() {
  const { icao = '', month = '', year = '' } = useParams()
  const [series, setSeries] = useState<WeatherMonth[]>([])

  useEffect(() => {
    if (!icao || !month || !year) {
      return
    }

    let mounted = true
    axios
      .get<WeatherMonth[]>('/api/v1/weatherdata', {
        params: { icao, month },
      })
      .then((res) => {
        if (mounted) {
          setSeries(res.data ?? [])
        }
      })
      .catch(() => {
        if (mounted) {
          setSeries([])
        }
      })

    return () => {
      mounted = false
    }
  }, [icao, month, year])

  const targetMonth = series.find((row) => String(row.year) === year)

  const avg = (key: keyof WeatherMonth): string => {
    const values = series
      .map((row) => Number(row[key] ?? Number.NaN))
      .filter((value) => Number.isFinite(value))

    if (!values.length) {
      return '-'
    }

    const total = values.reduce((sum, value) => sum + value, 0)
    return (total / values.length).toFixed(1)
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

function BlogPage() {
  const { page = '1', slug = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [selectedTag, setSelectedTag] = useState('')

  useEffect(() => {
    let mounted = true
    loadAllBlogPosts()
      .then((all) => {
        if (mounted) {
          setPosts(all)
        }
      })
      .catch(() => {
        if (mounted) {
          setPosts([])
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setSelectedTag(slug ?? '')
  }, [slug])

  const pageNumber = Number(page || 1)
  const pageSize = 4

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    posts.forEach((post) => post.tags.forEach((tag) => set.add(tag)))
    return Array.from(set).sort()
  }, [posts])

  const filtered = useMemo(() => {
    if (!selectedTag) {
      return posts
    }

    return posts.filter((post) => post.tags.includes(selectedTag))
  }, [posts, selectedTag])

  const start = (pageNumber - 1) * pageSize
  const currentPosts = filtered.slice(start, start + pageSize)

  return (
    <section className="card">
      <h2>Blog Page {pageNumber}</h2>
      <label className="filter-label" htmlFor="tag-filter">
        Filter by tag
      </label>
      <select id="tag-filter" value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
        <option value="">All tags</option>
        {availableTags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>

      {loading && <p>Loading articles...</p>}

      {!loading && currentPosts.length === 0 && <p>No posts found for this filter.</p>}

      <ul>
        {currentPosts.map((post) => (
          <li key={post.slug}>
            <Link to={`/blog/${post.slug}`}>{post.title}</Link>
            <p className="muted">
              {post.date} - {post.description}
            </p>
            {!!post.tags.length && (
              <div className="tags">
                {post.tags.map((tag) => (
                  <span className="tag" key={`${post.slug}-${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function BlogArticle() {
  const { slug = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState<BlogPost | null>(null)
  const [previousPost, setPreviousPost] = useState<BlogPost | null>(null)
  const [nextPost, setNextPost] = useState<BlogPost | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)

    loadAllBlogPosts()
      .then((allPosts) => {
        if (!mounted) {
          return
        }

        const index = allPosts.findIndex((item) => item.slug === decodeURIComponent(slug))
        setPost(index >= 0 ? allPosts[index] : null)
        setPreviousPost(index > 0 ? allPosts[index - 1] : null)
        setNextPost(index >= 0 && index < allPosts.length - 1 ? allPosts[index + 1] : null)
      })
      .catch(() => {
        if (mounted) {
          setPost(null)
          setPreviousPost(null)
          setNextPost(null)
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [slug])

  const sanitizedHtml = useMemo(() => DOMPurify.sanitize(post?.html ?? ''), [post?.html])

  return (
    <section className="card">
      {loading && <p>Loading article...</p>}
      {!loading && !post && <p>Article not found.</p>}

      {post && (
        <>
          <h2>{post.title}</h2>
          <p className="muted">{post.date}</p>
          {!!post.tags.length && (
            <div className="tags">
              {post.tags.map((tag) => (
                <span className="tag" key={`${post.slug}-${tag}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <article dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
          <div className="post-nav">
            {previousPost && <Link to={`/blog/${previousPost.slug}`}>Newer: {previousPost.title}</Link>}
            {nextPost && <Link to={`/blog/${nextPost.slug}`}>Older: {nextPost.title}</Link>}
          </div>
          <Link to="/blog/page/1">Back to blog</Link>
        </>
      )}
    </section>
  )
}

export default App
