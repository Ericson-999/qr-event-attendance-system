const DRAFT_KEY = 'joinFormDraft';
const DRAFT_FIELDS = ['fullName', 'schoolId', 'section', 'course', 'year'];

let selectedPhotoFile = null;

document.getElementById('joinForm').addEventListener('submit', handleJoin);
document.getElementById('retrieveForm').addEventListener('submit', handleRetrieve);

document.getElementById('takePhotoBtn').addEventListener('click', () => document.getElementById('photoCamera').click());
document.getElementById('choosePhotoBtn').addEventListener('click', () => document.getElementById('photoGallery').click());
document.getElementById('photoCamera').addEventListener('change', e => handlePhotoPicked(e.target.files[0]));
document.getElementById('photoGallery').addEventListener('change', e => handlePhotoPicked(e.target.files[0]));

restoreDraft();
DRAFT_FIELDS.forEach(id => {
  document.getElementById(id).addEventListener('input', saveDraft);
  document.getElementById(id).addEventListener('change', saveDraft);
});

function switchTab(tab) {
  const isRegister = tab === 'register';
  document.getElementById('tabRegisterBtn').classList.toggle('active', isRegister);
  document.getElementById('tabRetrieveBtn').classList.toggle('active', !isRegister);
  document.getElementById('registerPanel').style.display = isRegister ? 'block' : 'none';
  document.getElementById('retrievePanel').style.display = isRegister ? 'none' : 'block';
}

async function handlePhotoPicked(file) {
  if (!file) return;
  const errorMsg = document.getElementById('registerErrorMsg');
  errorMsg.textContent = '';

  try {
    const compressed = await compressImage(file, 900, 0.82);
    selectedPhotoFile = compressed;
    showPreview(compressed);
  } catch (err) {
    selectedPhotoFile = file;
    showPreview(file);
  }
}

function showPreview(fileOrBlob) {
  const previewUrl = URL.createObjectURL(fileOrBlob);
  const img = document.getElementById('photoPreviewImg');
  img.src = previewUrl;
  img.style.display = 'block';
  document.getElementById('photoPreviewPlaceholder').style.display = 'none';
}

function compressImage(file, maxDimension, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDimension) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => (blob ? resolve(blob) : reject(new Error('Canvas compression failed'))),
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function saveDraft() {
  const draft = {};
  DRAFT_FIELDS.forEach(id => { draft[id] = document.getElementById(id).value; });
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (err) {}
}

function restoreDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    DRAFT_FIELDS.forEach(id => {
      if (draft[id]) document.getElementById(id).value = draft[id];
    });
  } catch (err) {}
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch (err) {}
}

async function handleJoin(e) {
  e.preventDefault();
  const errorMsg = document.getElementById('registerErrorMsg');
  errorMsg.textContent = '';

  if (!selectedPhotoFile) {
    errorMsg.textContent = 'Please take or choose a photo first.';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading... please wait';

  const formData = new FormData();
  formData.append('fullName', document.getElementById('fullName').value.trim());
  formData.append('schoolId', document.getElementById('schoolId').value.trim());
  formData.append('section', document.getElementById('section').value);
  formData.append('year', document.getElementById('year').value);
  formData.append('course', document.getElementById('course').value.trim());
  formData.append('photo', selectedPhotoFile, 'photo.jpg');

  try {
    const res = await fetch('/api/public/register', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || 'Registration failed';
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      return;
    }

    document.getElementById('qrImage').src = data.qrDataUrl;
    document.getElementById('downloadLink').href = data.qrDataUrl;
    document.getElementById('downloadLink').download = `${data.student.schoolId}_qr.png`;
    document.getElementById('qrStudentName').textContent = `${data.student.fullName} (${data.student.schoolId})`;
    document.getElementById('qrResult').style.display = 'block';
    document.getElementById('joinForm').style.display = 'none';
    clearDraft();
  } catch (err) {
    errorMsg.textContent = 'Could not reach server';
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

async function handleRetrieve(e) {
  e.preventDefault();
  const errorMsg = document.getElementById('retrieveErrorMsg');
  errorMsg.textContent = '';

  const fullName = document.getElementById('retrieveFullName').value.trim();
  const schoolId = document.getElementById('retrieveSchoolId').value.trim();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Searching...';

  try {
    const res = await fetch('/api/public/retrieve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, schoolId }),
    });
    const data = await res.json();
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    if (!res.ok) {
      errorMsg.textContent = data.error || 'Could not find your registration';
      return;
    }

    document.getElementById('retrieveQrImage').src = data.qrDataUrl;
    document.getElementById('retrieveDownloadLink').href = data.qrDataUrl;
    document.getElementById('retrieveDownloadLink').download = `${data.student.schoolId}_qr.png`;
    document.getElementById('retrieveStudentName').textContent = `${data.student.fullName} (${data.student.schoolId})`;
    document.getElementById('retrieveResult').style.display = 'block';
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
    errorMsg.textContent = 'Could not reach server';
  }
}
