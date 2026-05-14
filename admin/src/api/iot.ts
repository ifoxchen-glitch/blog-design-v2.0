import { request, type ApiResponse } from './request'
import type { AxiosInstance } from 'axios'

export interface IotCardItem {
  id: number
  iccid: string
  msisdn: string
  imsi: string
  operator: string
  cardType: string
  comboName: string
  comboResidue: number
  comboUsed: number
  comboTotal: number
  periodValidity: string
  status: string
  gprsState: string
  onOffStatus: string
  activatedState: string
  realPosition: string
  activationTime: string
  endTime: string
  remarks: string
  lastSyncTime: string
  createdAt: string
  updatedAt: string
}

export interface IotCardQuery {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface IotBalanceResult {
  amount: string
}

export async function apiGetIotCards(
  params: IotCardQuery = {},
  client: AxiosInstance = request,
): Promise<{ items: IotCardItem[]; total: number; page: number; pageSize: number }> {
  const res = await client.get<ApiResponse<{ items: IotCardItem[]; total: number; page: number; pageSize: number }>>(
    '/api/v2/admin/iot/cards',
    { params },
  )
  return res.data.data
}

export async function apiGetIotCard(
  id: number,
  client: AxiosInstance = request,
): Promise<IotCardItem> {
  const res = await client.get<ApiResponse<IotCardItem>>(`/api/v2/admin/iot/cards/${id}`)
  return res.data.data
}

export async function apiQueryIotCard(
  cardNo: string,
  client: AxiosInstance = request,
): Promise<IotCardItem> {
  const res = await client.post<ApiResponse<IotCardItem>>(
    '/api/v2/admin/iot/card/query',
    { cardNo },
  )
  return res.data.data
}

export async function apiBatchQueryIotCards(
  cardNos: string[],
  client: AxiosInstance = request,
): Promise<IotCardItem[]> {
  const res = await client.post<ApiResponse<IotCardItem[]>>(
    '/api/v2/admin/iot/card/batch',
    { cardNos },
  )
  return res.data.data
}

export async function apiGetIotBalance(
  client: AxiosInstance = request,
): Promise<IotBalanceResult> {
  const res = await client.get<ApiResponse<IotBalanceResult>>('/api/v2/admin/iot/balance')
  return res.data.data
}

export async function apiDisableIotCard(
  cardNo: string,
  client: AxiosInstance = request,
): Promise<boolean> {
  const res = await client.post<ApiResponse<boolean>>(
    '/api/v2/admin/iot/card/disable',
    { cardNo },
  )
  return res.data.data
}

export async function apiEnableIotCard(
  cardNo: string,
  client: AxiosInstance = request,
): Promise<boolean> {
  const res = await client.post<ApiResponse<boolean>>(
    '/api/v2/admin/iot/card/enable',
    { cardNo },
  )
  return res.data.data
}

export async function apiUpdateIotCard(
  id: number,
  remarks: string,
  client: AxiosInstance = request,
): Promise<IotCardItem> {
  const res = await client.put<ApiResponse<IotCardItem>>(
    `/api/v2/admin/iot/card/${id}`,
    { remarks },
  )
  return res.data.data
}

export async function apiDeleteIotCard(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/iot/card/${id}`)
}