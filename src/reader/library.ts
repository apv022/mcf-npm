interface LibraryCourse {
  id: string;
  title: string;
  description?: string;
  authors?: string[];
  cover?: string;
  version?: string;
  lessons: string[];
}
declare global {
  interface Window {
    MCF_LIBRARY?: LibraryCourse[];
  }
}
const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const root = document.querySelector('#courses');
if (root) {
  const courses = window.MCF_LIBRARY ?? [];
  root.innerHTML = courses.length
    ? courses
        .map((course) => {
          let state: { lessons?: Record<string, boolean> } = {};
          try {
            state = JSON.parse(
              localStorage.getItem(`mcf:${course.id}:${course.version || 'unversioned'}`) || '{}',
            );
          } catch {
            /* Ignore invalid local state. */
          }
          const done = course.lessons.filter((id) => state.lessons?.[id]).length,
            progress = course.lessons.length ? Math.round((done / course.lessons.length) * 100) : 0,
            cover =
              course.cover && /^https?:/i.test(course.cover)
                ? course.cover
                : course.cover
                  ? `${course.id}/${course.cover}`
                  : undefined;
          return `<a class="course-card" href="${encodeURIComponent(course.id)}/index.html">${cover ? `<img src="${encodeURI(cover)}" alt="">` : '<div class="cover-placeholder">MCF</div>'}<div><span class="eyebrow">${progress === 100 ? 'Completed' : 'Course'}</span><h2>${escape(course.title)}</h2><p>${escape(course.description)}</p><small>${escape((course.authors ?? []).join(', '))}</small><div class="progress"><i style="width:${progress}%"></i></div><b>${progress}%</b></div></a>`;
        })
        .join('')
    : '<div class="empty"><h2>No compiled courses yet</h2><p>Compile an MCF package to add it here.</p></div>';
}
