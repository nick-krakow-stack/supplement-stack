import creatorSharing from '../../../functions/api/modules/creator-sharing.ts';
import creatorSharingAdmin from '../../../functions/api/modules/creator-sharing-admin.ts';
import admin from '../../../functions/api/modules/admin.ts';
import products from '../../../functions/api/modules/products.ts';

const HonoConstructor = creatorSharing.constructor;
const app = new HonoConstructor();
app.route('/api/creator-sharing', creatorSharing);
app.route('/api/admin/creator-sharing', creatorSharingAdmin);
app.route('/api/admin', admin);
app.route('/api/products', products);

export function fetchCreatorSharingHono(request, env, executionContext) {
  return app.fetch(request, env, executionContext);
}
