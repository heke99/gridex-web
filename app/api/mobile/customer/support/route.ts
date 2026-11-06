import { customerDetailRoute } from '@/lib/mobile/customerRuntime';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const GET = customerDetailRoute('support');

import { supportMutation } from '@/lib/mobile/supportWriteRuntime';
export const POST = supportMutation();
