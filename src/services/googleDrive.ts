/**
 * Google Drive API v3 Service
 * Handles folder organization (Year/Month -> RHK) and file uploads for ASN supporting documents
 */

export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
  folderPath: string;
}

/**
 * Find or create a folder in Google Drive by name and parentId
 */
export async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<{ id: string; webViewLink?: string }> {
  const safeName = folderName.replace(/'/g, "\\'");
  const parentQuery = parentId ? `'${parentId}' in parents` : "'root' in parents";
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and ${parentQuery} and trashed = false`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name,webViewLink)&pageSize=1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal mencari folder di Google Drive');
  }

  const data = await searchRes.json();
  if (data.files && data.files.length > 0) {
    return { id: data.files[0].id, webViewLink: data.files[0].webViewLink };
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal membuat folder di Google Drive');
  }

  const created = await createRes.json();
  return { id: created.id, webViewLink: created.webViewLink };
}

/**
 * Ensures complete folder hierarchy:
 * "e-Kinerja ASN" -> "Periode [YYYY-MM]" -> "RHK [No] - [Nama RHK Singkat]"
 */
export async function ensureDriveFolderStructure(
  accessToken: string,
  periodeBulan: string, // YYYY-MM
  rhkNomor: number | string,
  rhkNama: string
): Promise<{ folderId: string; folderPath: string }> {
  // 1. Root App folder
  const root = await getOrCreateFolder(accessToken, 'e-Kinerja ASN');

  // 2. Month folder
  const monthLabel = `Periode ${periodeBulan || 'Umum'}`;
  const monthFolder = await getOrCreateFolder(accessToken, monthLabel, root.id);

  // 3. RHK subfolder
  const cleanRhkTitle = rhkNama
    ? rhkNama.slice(0, 40).replace(/[/\\?%*:|"<>]/g, ' ')
    : 'Umum';
  const rhkLabel = `RHK ${rhkNomor} - ${cleanRhkTitle}`;
  const rhkFolder = await getOrCreateFolder(accessToken, rhkLabel, monthFolder.id);

  const folderPath = `e-Kinerja ASN / ${monthLabel} / ${rhkLabel}`;
  return { folderId: rhkFolder.id, folderPath };
}

/**
 * Uploads supporting evidence file to the structured Google Drive folder
 */
export async function uploadBuktiToDrive(
  accessToken: string,
  file: File,
  periodeBulan: string,
  rhkNomor: number | string,
  rhkNama: string
): Promise<DriveUploadResult> {
  // 1. Create/Find folder structure
  const { folderId, folderPath } = await ensureDriveFolderStructure(
    accessToken,
    periodeBulan,
    rhkNomor,
    rhkNama
  );

  // 2. Multipart Upload
  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal mengunggah berkas ke Google Drive');
  }

  const result = await uploadRes.json();

  return {
    fileId: result.id,
    name: result.name || file.name,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    folderPath,
  };
}
