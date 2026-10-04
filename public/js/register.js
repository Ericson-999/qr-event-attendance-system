document.getElementById('regForm').addEventListener('submit', handleRegister);
document.getElementById('editForm').addEventListener('submit', handleEditSave);
document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
document.getElementById('editModalBackdrop').addEventListener('click', e => {
  if (e.target.id === 'editModalBackdrop') closeEditModal();
});

document.getElementById('shareLinkInput').value = `${window.location.origin}/join.html`;
loadStudents();

function copyShareLink() {
  const input = document.getElementById('shareLinkInput');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = event.target;
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = original), 1500);
  });
}

async function handleRegister(e) {
  e.preventDefault();
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = '';

  const formData = new FormData();
  formData.append('fullName', document.getElementById('fullName').value.trim());
  formData.append('schoolId', document.getElementById('schoolId').value.trim());
  formData.append('section', document.getElementById('section').value);
  formData.append('year', document.getElementById('year').value);
  formData.append('course', document.getElementById('course').value.trim());
  const photoFile = document.getElementById('photo').files[0];
  if (photoFile) formData.append('photo', photoFile);

  try {
    const res = await fetch('/api/students', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || 'Registration failed';
      return;
    }

    document.getElementById('qrImage').src = data.qrDataUrl;
    document.getElementById('downloadLink').href = data.qrDataUrl;
    document.getElementById('downloadLink').download = `${data.student.schoolId}_qr.png`;
    document.getElementById('qrStudentName').textContent = `${data.student.fullName} (${data.student.schoolId})`;
    document.getElementById('qrResult').style.display = 'block';
    document.getElementById('regForm').style.display = 'none';

    loadStudents();
  } catch (err) {
    errorMsg.textContent = 'Could not reach server';
  }
}

function resetForm() {
  document.getElementById('regForm').reset();
  document.getElementById('regForm').style.display = 'block';
  document.getElementById('qrResult').style.display = 'none';
}

async function loadStudents() {
  const res = await fetch('/api/students');
  if (!res.ok) return;
  const students = await res.json();
  const tbody = document.querySelector('#studentsTable tbody');
  tbody.innerHTML = '';
  students.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(s.fullName)}</td>
      <td>${escapeHtml(s.schoolId)}</td>
      <td>${escapeHtml(s.section)}</td>
      <td>${escapeHtml(s.course)}</td>
      <td>${escapeHtml(s.year)}</td>
      <td><button class="secondary" onclick="viewQr('${s._id}')">View QR</button></td>
      <td>
        <div class="action-btns">
          <button class="secondary" onclick="openEditModal('${s._id}')">Edit</button>
          <button class="danger" onclick="deleteStudent('${s._id}', '${escapeHtml(s.fullName).replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function viewQr(id) {
  const res = await fetch(`/api/students/${id}/qr`);
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Failed to load QR');
  const win = window.open('', '_blank', 'width=320,height=380');
  win.document.write(`<img src="${data.qrDataUrl}" style="width:280px" />`);
}

async function deleteStudent(id, name) {
  if (!confirm(`Delete ${name}? This also removes their attendance QR and cannot be undone.`)) return;
  const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error || 'Failed to delete student');
    return;
  }
  loadStudents();
}

async function openEditModal(id) {
  const res = await fetch(`/api/students/${id}`);
  const student = await res.json();
  if (!res.ok) return alert(student.error || 'Failed to load student');

  document.getElementById('editId').value = student._id;
  document.getElementById('editFullName').value = student.fullName;
  document.getElementById('editSchoolId').value = student.schoolId;
  document.getElementById('editSection').value = student.section;
  document.getElementById('editYear').value = student.year;
  document.getElementById('editCourse').value = student.course;
  document.getElementById('editPhoto').value = '';
  document.getElementById('editErrorMsg').textContent = '';

  const photoImg = document.getElementById('editCurrentPhoto');
  photoImg.src = student.photoPath || '';
  photoImg.onerror = function () {
    this.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="%23eef1f7"/></svg>'
    );
  };

  document.getElementById('editModalBackdrop').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModalBackdrop').style.display = 'none';
}

async function handleEditSave(e) {
  e.preventDefault();
  const errorMsg = document.getElementById('editErrorMsg');
  errorMsg.textContent = '';

  const id = document.getElementById('editId').value;
  const formData = new FormData();
  formData.append('fullName', document.getElementById('editFullName').value.trim());
  formData.append('schoolId', document.getElementById('editSchoolId').value.trim());
  formData.append('section', document.getElementById('editSection').value);
  formData.append('year', document.getElementById('editYear').value);
  formData.append('course', document.getElementById('editCourse').value.trim());
  const photoFile = document.getElementById('editPhoto').files[0];
  if (photoFile) formData.append('photo', photoFile);

  try {
    const res = await fetch(`/api/students/${id}`, { method: 'PUT', body: formData });
    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || 'Failed to save changes';
      return;
    }
    closeEditModal();
    loadStudents();
  } catch (err) {
    errorMsg.textContent = 'Could not reach server';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
