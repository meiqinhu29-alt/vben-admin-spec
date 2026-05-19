import { requestClient } from '#/api/request';

export interface ReportAttachment {
  id: string;
  reportId: string;
  fieldName: string;
  url: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

export function listAttachmentsApi(reportId: string) {
  return requestClient.get<ReportAttachment[]>(`/attachments/${reportId}`);
}

export function deleteAttachmentApi(id: string) {
  return requestClient.delete(`/attachments/${id}`);
}

export function uploadAttachmentApi(
  reportId: string,
  fieldName: string,
  file: File,
) {
  return requestClient.upload<ReportAttachment>(
    `/attachments/${reportId}/${fieldName}`,
    { file },
  );
}
