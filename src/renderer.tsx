import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="de">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Supplement Stack - Intelligente Nahrungsergänzung</title>
        <meta name="description" content="Verwalte deine Nahrungsergänzungsmittel intelligent - wirkstoffbasierte Suche, Interaktionswarnungen und Preisoptimierung." />
        
        {/* Tailwind CSS */}
        <script src="https://cdn.tailwindcss.com"></script>
        
        {/* FontAwesome Icons */}
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
        
        {/* Custom CSS */}
        <link href="/static/style.css" rel="stylesheet" />
        
        {/* Tailwind Config */}
        <script dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    'supplement': {
                      50: '#f0fdf4',
                      100: '#dcfce7',
                      200: '#bbf7d0',
                      300: '#86efac',
                      400: '#4ade80',
                      500: '#22c55e',
                      600: '#16a34a',
                      700: '#15803d',
                      800: '#166534',
                      900: '#14532d'
                    }
                  }
                }
              }
            }
          `
        }} />
      </head>
      <body className="bg-gray-50 font-sans antialiased">
        {children}
        
        {/* JavaScript Libraries */}
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
        
        {/* Dosage Calculator */}
        <script src="/static/dosage-frontend.js"></script>
        
        {/* Main App JavaScript */}
        <script src="/static/app.js"></script>
      </body>
    </html>
  )
})
