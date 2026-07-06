import en_common from '../../messages/en/common.json'
import en_setup from '../../messages/en/setup.json'
import en_auth from '../../messages/en/auth.json'
import en_dashboard from '../../messages/en/dashboard.json'
import en_activities from '../../messages/en/activities.json'
import en_app from '../../messages/en/app.json'
import en_admin from '../../messages/en/admin.json'

type Messages = {
  common: typeof en_common
  setup: typeof en_setup
  auth: typeof en_auth
  dashboard: typeof en_dashboard
  activities: typeof en_activities
  app: typeof en_app
  admin: typeof en_admin
}

declare global {
  // Use type safe message keys with `next-intl`
  interface IntlMessages extends Messages {}
}
