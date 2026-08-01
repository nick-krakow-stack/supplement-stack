import admin from '../../../functions/api/modules/admin.ts';
import ingredients from '../../../functions/api/modules/ingredients.ts';
import products from '../../../functions/api/modules/products.ts';
import stacks from '../../../functions/api/modules/stacks.ts';
import userProducts from '../../../functions/api/modules/user-products.ts';

const HonoConstructor = ingredients.constructor;
const app = new HonoConstructor();

app.route('/api/admin', admin);
app.route('/api/ingredients', ingredients);
app.route('/api/products', products);
app.route('/api/stacks', stacks);
app.route('/api/user-products', userProducts);

export function fetchSubpartsHono(request, env, executionContext) {
  return app.fetch(request, env, executionContext);
}
