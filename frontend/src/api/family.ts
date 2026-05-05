import { apiClient } from './client';
import type { FamilyMember } from '../types';

export type FamilyMemberInput = {
  first_name: string;
  age?: number | null;
  weight?: number | null;
};

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  const res = await apiClient.get<{ members: FamilyMember[] }>('/family');
  return res.data.members;
}

export async function createFamilyMember(input: FamilyMemberInput): Promise<FamilyMember> {
  const res = await apiClient.post<{ member: FamilyMember }>('/family', input);
  return res.data.member;
}

export async function updateFamilyMember(id: number, input: FamilyMemberInput): Promise<FamilyMember> {
  const res = await apiClient.put<{ member: FamilyMember }>(`/family/${id}`, input);
  return res.data.member;
}

export async function deleteFamilyMember(id: number): Promise<void> {
  await apiClient.delete(`/family/${id}`);
}
