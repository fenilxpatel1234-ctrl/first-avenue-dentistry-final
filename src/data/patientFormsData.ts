export interface PatientFormItem {
  id: string;
  title: string;
  shortTitle: string;
  contactLabel: string;
  subtitle: string;
  ageGroup: string;
  description: string;
  fileUrl: string;
  downloadUrl: string;
  downloadFileName: string;
}

export const PATIENT_FORMS: PatientFormItem[] = [
  {
    id: "medical-history-adult",
    title: "Adult Medical & Dental History Form",
    shortTitle: "Medical History (Adult)",
    contactLabel: "• MEDICAL HISTORY - ADULT",
    subtitle: "For Adult & General Patients",
    ageGroup: "Adults (18+)",
    description:
      "Complete personal information, dental history, and medical history questionnaire for adult patients visiting First Avenue Family Dentistry.",
    fileUrl: "/assets/aistudio/Medical_History_05b70b07.pdf",
    downloadUrl: "/api/patient-forms/medical-history-adult",
    downloadFileName: "Medical_History.pdf",
  },
  {
    id: "medical-history-child-over-5",
    title: "Child Medical & Dental History (Over 5)",
    shortTitle: "Medical History — Child Over 5",
    contactLabel: "• MEDICAL HISTORY - CHILD OVER 5",
    subtitle: "For Children & Teens Ages 5+",
    ageGroup: "Child Over 5 Years",
    description:
      "Pediatric medical and dental history form tailored for children over 5 years of age, including orthodontic and developmental health details.",
    fileUrl: "/assets/aistudio/MedicalHistory-ChildOver5_9e542a0e.pdf",
    downloadUrl: "/api/patient-forms/medical-history-child-over-5",
    downloadFileName: "MedicalHistory-ChildOver5.pdf",
  },
  {
    id: "medical-history-child-under-5",
    title: "Child Medical & Dental History (Under 5)",
    shortTitle: "Medical History — Child Under 5",
    contactLabel: "• MEDICAL HISTORY - CHILD UNDER 5",
    subtitle: "For Infants & Toddlers Under 5",
    ageGroup: "Child Under 5 Years",
    description:
      "Early childhood dental and medical intake form for children under 5 years old, covering primary teeth eruption, feeding habits, and medical history.",
    fileUrl: "/assets/aistudio/Medical_History-ChildUnder_5_e416bea1.pdf",
    downloadUrl: "/api/patient-forms/medical-history-child-under-5",
    downloadFileName: "Medical_History-ChildUnder_5.pdf",
  },
];

export async function triggerPatientFormDownload(
  form: PatientFormItem,
  e?: React.MouseEvent
) {
  if (e) {
    e.preventDefault();
  }
  try {
    const response = await fetch(form.fileUrl);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const blob = await response.blob();
    const pdfBlob = new Blob([blob], { type: "application/pdf" });
    const blobUrl = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = form.downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
  } catch {
    const link = document.createElement("a");
    link.href = form.downloadUrl;
    link.download = form.downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
