
/* PNG EXPORT */

function saveCanvas(canvas, name) {
    canvas.toBlob(blob => {
        if (blob) {
            IDApp.downloadBlob(blob, name);
        }
    }, "image/png");
}

/* Clean filename */
function cleanFileName(value) {
    return String(value || "")
        .trim()
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toUpperCase();
}

/* Get student surname and ID filename */
function getStudentFileName(side) {
    const fullName = document
        .getElementById("studentName")
        .value
        .trim();

    // Use the last word in the full name as the surname
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const lastName = nameParts.length
        ? nameParts[nameParts.length - 1]
        : "STUDENT";

    const course = document
        .getElementById("course")
        .value;

    const studentId = document
        .getElementById("studentNumber")
        .value;

    const parts = [
        cleanFileName(lastName) || "STUDENT",
        cleanFileName(course) || "COURSE",
        cleanFileName(studentId) || "NO-ID",
        side.toLowerCase()
    ];

    return parts.join("-") + ".png";
}

/* Download current ID side as PNG */
document.getElementById("exportPngBtn").onclick = () => {
    const side = IDCardEditor.state.side;

    const filename = getStudentFileName(side);

    saveCanvas(
        IDCardEditor.imageData(side),
        filename
    );
};

/* PRINT BOTH SIDES */
function printCanvases(canvases) {
    document.querySelectorAll(".print-sheet").forEach(x => x.remove());

    const sheet = document.createElement("div");
    sheet.className = "print-sheet";

    canvases.forEach(canvas => {
        const copy = document.createElement("canvas");

        copy.width = canvas.width;
        copy.height = canvas.height;

        copy.getContext("2d").drawImage(canvas, 0, 0);

        sheet.append(copy);
    });

    document.body.append(sheet);

    window.print();

    setTimeout(() => sheet.remove(), 1000);
}

/* Print button */
document.getElementById("printBtn").onclick = () => {
    printCanvases([
        IDCardEditor.imageData("front"),
        IDCardEditor.imageData("back")
    ]);
};

/* Preview print button */
document.getElementById("previewPrintBtn").onclick = () => {
    document.getElementById("previewModal").classList.add("hidden");

    printCanvases([
        IDCardEditor.imageData("front"),
        IDCardEditor.imageData("back")
    ]);
};

/* Automatically save editor data before leaving */
window.addEventListener("beforeunload", () => {
    IDCardEditor.persist();
});
