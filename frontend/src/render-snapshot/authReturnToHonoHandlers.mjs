import auth, { meApp } from '../../../functions/api/modules/auth.ts';

const HonoConstructor = auth.constructor;
const app = new HonoConstructor();
app.route('/api/auth', auth);
app.route('/api/me', meApp);

export function fetchAuthReturnToHono(request, env, executionContext) {
  return app.fetch(request, env, executionContext);
}
