import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();
const port = Number(process.env.PORT || 4000);

app.fire();
if (import.meta.main) {
  console.log(`Backend running on http://localhost:${port}`);
  app.listen(port);
}
