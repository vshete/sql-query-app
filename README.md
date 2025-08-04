# ⚡️ Next.js SQL Query App

> Modern, Fast, Extensible.  
> Input any SQL query, see results in real time, and download your data – all in a slick React/Next.js UI.

---

## 🎥 Demo Video
You can watch the youtube video here:
[Demo Video](https://www.youtube.com/watch?v=LAL_6Qrgj7o)


---

## 🌍 Hosted App
Deployed using Vercel at [App Live Link](https://sql-query-app-lac.vercel.app/)

---

## 🚀 Features

- **Two Primary Panels**:
  - **Input**: QueryBox for free-form SQL input and predefined query templates.
  - **Output**: Table with dynamic resizing, sortable columns, and pagination.
- **Validation**: Ensures non-empty query before submission.
- **Loading State**: Spinner + input freeze, avoids duplicates & informs user.
- **Error Handling**: Clear failure messages on any API/query failure.
- **CSV Downloads**: Export table data for external use in one click.
- **Save Query**: Placeholder "save" feature for favorites, with planned extension.
- **Predefined Query Sidebar**: For fast, common queries – one click to use.
- **Glitch-Free UX**: Memoized cells/rows, efficient state usage & React best practices.
- **Production-Grade & Fast**: Code-split, statically optimized, barely-there page loads.
- **Componentized**: Easy to read, test, and extend code.

---

## 🛠️ Performance Optimizations

- **React.memo**: Table rows & cells do not re-render unless data changes.
- **Minimal API Payloads**: Results are paged, not all-at-once; lower memory & instant table loads.
- **Quick API Responses**: Minimal payload and response sizes for API calls.
- **No UI Jank**: UX always responsive, even on heavy queries or large datasets.
- **Optimized CSS & Fonts**: Fonts and CSS styles form Tailwind CSS.
- **Table using Tanstack**: React tables rendered using Tanstack for best performance.

---

## 📦 Get Started (Development)

Clone and run the dev server in only a few commands:

1. Clone the repo [SQL QUERY APP](https://github.com/vshete/sql-query-app)
```bash
    git clone https://github.com/vshete/sql-query-app.git
```

2. Install dependencies (npm or yarn)
Go to the roo dir and run
```bash
npm install
```

3. Start dev server – hot reloading on save
In the root dir run
```bash
npm run dev
```
4. Open your browser to see the app in local host
[Local Host](http://localhost:3000)

---

## 🏗️ Production Build

Build and launch a production-optimized server:

Build step (Next.js, optimizations applied)
```bash
npm run build
```

Start the server
```bash
npm start
```

---

## 📚 GitHub Repo

[SQL QUERY APP Repository on Github](https://github.com/vshete/sql-query-app)

---

## 📑 License

MIT LISENCE

---

## 🤝 Contributing

Pull requests are welcome!
