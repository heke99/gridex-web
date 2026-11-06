import { customerResourceRoute } from '@/lib/mobile/customerRuntime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const GET = customerResourceRoute('contracts');
