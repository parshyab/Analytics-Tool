/// <reference types="@figma/plugin-typings" />

declare const __html__: string;
declare const __LUMI_DEV_MODE__: boolean | undefined;
declare const __LUMI_ANALYTICS_API_URL__: string | undefined;
declare const __LUMI_ANALYTICS_OWNER_KEY__: string | undefined;
declare const __LUMI_ADMIN_EMAILS__: string | undefined;
declare const __LUMI_REPORT_RECIPIENT_OPTIONS__: string | undefined;
declare const __LUMI_UI_BUILD_STAMP__: string | undefined;

declare module "*.json" {
  const value: unknown;
  export default value;
}
