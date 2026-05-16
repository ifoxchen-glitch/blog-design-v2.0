// IoT Card Management API client
import { request, type ApiResponse } from './request'
import type { AxiosInstance } from 'axios'

export interface CardItem {
  cardNo: string
  msisdn: string
  imsi: string
  iccid: string
  operator: string
  cardType: string
  comboName: string
  comboResidue: number
  comboUsed: number
  comboTotal: number
  status: string
  gprsState: string
  onOffStatus: string
  activatedState: string
  realPosition: string | null
  activationTime: string | null
  endTime: string | null
  rawJson?: Record<string, unknown> | null
  syncedAt?: string | null
}

export interface CardListQuery {
  keyword?: string
  status?: string
  operator?: string
  region?: string
  combo?: string
  sortKey?: string
  sortOrder?: 'asc' | 'desc'
}

export interface StatsData {
  total: number
  online: number
  offline: number
  stopped: number
  separated: number
  totalUsed: number
  totalTotal: number
  totalResidue: number
  operatorDist: { operator: string; count: number }[]
  regionDist: { region: string; count: number }[]
  comboDist: { combo: string; count: number }[]
  trend: { hour: string; totalUsed: number }[]
  gprsStateDist: { state: string; count: number }[]
}

export interface HistoryItem {
  label: string
  used?: number
  residue?: number
  total?: number
  avgUsed?: number
  maxUsed?: number
  minUsed?: number
}

export async function apiGetCards(
  params: CardListQuery & { page: number; pageSize: number },
  client: AxiosInstance = request,
): Promise<{ items: CardItem[]; total: number; page: number; pageSize: number }> {
  const res = await client.get<ApiResponse<{ items: CardItem[]; total: number; page: number; pageSize: number }>>(
    '/api/v2/admin/iot/cards',
    { params },
  )
  return res.data.data
}

export async function apiGetStats(
  client: AxiosInstance = request,
): Promise<StatsData> {
  const res = await client.get<ApiResponse<StatsData>>(
    '/api/v2/admin/iot/cards/stats',
  )
  return res.data.data
}

export async function apiGetCard(
  cardNo: string,
  client: AxiosInstance = request,
): Promise<CardItem> {
  const res = await client.get<ApiResponse<CardItem>>(
    `/api/v2/admin/iot/cards/${encodeURIComponent(cardNo)}`,
  )
  return res.data.data
}

export async function apiGetCardHistory(
  cardNo: string,
  precision: 'hour' | 'day' | 'week' = 'hour',
  client: AxiosInstance = request,
): Promise<{ items: HistoryItem[]; precision: string }> {
  const res = await client.get<ApiResponse<{ items: HistoryItem[]; precision: string }>>(
    `/api/v2/admin/iot/cards/${encodeURIComponent(cardNo)}/history`,
    { params: { precision } },
  )
  return res.data.data
}

export interface UsageByRegionData {
  labels: string[]
  regions: string[]
  series: Array<{ name: string; data: number[] }>
  totals: number[]
  period: string
}

export async function apiGetUsageByRegion(
  params?: { date?: string; period?: string },
  client: AxiosInstance = request,
): Promise<UsageByRegionData> {
  const res = await client.get<ApiResponse<UsageByRegionData>>(
    '/api/v2/admin/iot/cards/usage-by-region', { params },
  )
  return res.data.data
}

export async function apiSyncCards(
  client: AxiosInstance = request,
): Promise<{ cardCount: number }> {
  const res = await client.post<ApiResponse<{ cardCount: number }>>(
    '/api/v2/admin/iot/cards/sync',
  )
  return res.data.data
}

export async function apiBatchCards(
  cardNos: string[],
  client: AxiosInstance = request,
): Promise<{ items: CardItem[]; total: number }> {
  const res = await client.post<ApiResponse<{ items: CardItem[]; total: number }>>(
    '/api/v2/admin/iot/cards/batch',
    { cardNos },
  )
  return res.data.data
}

export async function apiGetBalance(
  client: AxiosInstance = request,
): Promise<{ amount: string }> {
  const res = await client.get<ApiResponse<{ amount: string }>>(
    '/api/v2/admin/iot/cards/balance',
  )
  return res.data.data
}

export async function apiDeleteCard(
  cardNo: string,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(
    `/api/v2/admin/iot/cards/${encodeURIComponent(cardNo)}`,
  )
}

export async function apiDisableCard(
  cardNo: string,
  client: AxiosInstance = request,
): Promise<void> {
  await client.put<ApiResponse<void>>(
    `/api/v2/admin/iot/cards/${encodeURIComponent(cardNo)}/disable`,
  )
}

export async function apiEnableCard(
  cardNo: string,
  client: AxiosInstance = request,
): Promise<void> {
  await client.put<ApiResponse<void>>(
    `/api/v2/admin/iot/cards/${encodeURIComponent(cardNo)}/enable`,
  )
}