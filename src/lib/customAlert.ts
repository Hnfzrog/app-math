export function customAlert(message: string, isError: boolean = false) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.log('[customAlert]', message);
    return;
  }

  let overlay = document.getElementById('custom-alert-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'custom-alert-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'none';
    
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.style.maxWidth = '400px';
    
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const title = document.createElement('h3');
    title.id = 'custom-alert-title';
    title.innerText = 'Pemberitahuan';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-close-modal';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => { overlay!.style.display = 'none'; };
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    const messageP = document.createElement('p');
    messageP.id = 'custom-alert-message';
    messageP.style.marginTop = '0';
    messageP.style.marginBottom = '0';
    
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.marginTop = '24px';
    
    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-primary';
    okBtn.innerText = 'OK';
    okBtn.onclick = () => { overlay!.style.display = 'none'; };
    
    footer.appendChild(okBtn);
    body.appendChild(messageP);
    body.appendChild(footer);
    
    dialog.appendChild(header);
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    
    document.body.appendChild(overlay);
  }
  
  const titleEl = document.getElementById('custom-alert-title');
  if (titleEl) {
    titleEl.innerText = isError ? 'Error / Peringatan' : 'Berhasil / Info';
    titleEl.style.color = isError ? 'var(--danger, #dc3545)' : 'var(--primary, #2563eb)';
  }
  
  const messageEl = document.getElementById('custom-alert-message');
  if (messageEl) {
    messageEl.innerText = message;
  }
  
  overlay.style.display = 'flex';
}
