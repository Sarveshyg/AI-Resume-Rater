import React, { type FormEvent, useState } from 'react';
import Navbar from '~/components/Navbar';
import FileUploader from '~/components/FileUploader';
import { usePuterStore } from '~/lib/puter';
import { useNavigate } from 'react-router';
import { convertPdfToImage } from '~/lib/pdf2image';
import { generateUUID } from '~/lib/utils';
import { prepareInstructions } from '../../constants';

// Define a clear type for the analysis data
interface AnalysisData {
    id: string;
    resumePath: string;
    imagePath: string;
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    feedback: any; // Or a more specific feedback interface
}

const Upload = () => {
    const { fs, ai, kv } = usePuterStore();
    const navigate = useNavigate();

    // State management for the component's flow
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    // Clears all state and resets the form for another attempt
    const handleReset = () => {
        setIsProcessing(false);
        setStatusText("");
        setError(null);
        setFile(null);
        // If the form fields need clearing, you can do that here
        const form = document.getElementById('upload-form') as HTMLFormElement;
        form?.reset();
    };

    const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File }) => {
        setIsProcessing(true);
        setError(null); // Clear previous errors

        try {
            // STEP 1: Upload the original PDF file
            setStatusText('Uploading resume...');
            const uploadedFile = await fs.upload([file]);
            if (!uploadedFile) {
                throw new Error('Failed to upload PDF file. The server returned an empty response.');
            }

            // STEP 2: Convert PDF to an image for preview
            setStatusText('Generating resume preview...');
            const imageConversionResult = await convertPdfToImage(file);
            if (imageConversionResult.error || !imageConversionResult.file) {
                // Use the detailed error from the conversion function if available
                throw new Error(imageConversionResult.error || 'Failed to convert PDF to an image.');
            }

            // STEP 3: Upload the generated image
            setStatusText('Uploading preview image...');
            const uploadedImage = await fs.upload([imageConversionResult.file]);
            if (!uploadedImage) {
                throw new Error('Failed to upload the generated preview image.');
            }

            // STEP 4: Prepare and save initial data
            setStatusText('Preparing analysis...');
            const uuid = generateUUID();
            const data: AnalysisData = {
                id: uuid,
                resumePath: uploadedFile.path,
                imagePath: uploadedImage.path,
                companyName,
                jobTitle,
                jobDescription,
                feedback: '', // Placeholder for now
            };
            await kv.set(`resume:${uuid}`, JSON.stringify(data));

            // STEP 5: Call the AI for feedback
            setStatusText('Analyzing your resume with AI...');
            const feedbackResponse = await ai.feedback(
                uploadedFile.path,
                prepareInstructions({ jobTitle, jobDescription }) // Assuming the AI can read the text from the path
            );
            if (!feedbackResponse) {
                throw new Error('The AI analysis returned an empty response.');
            }

            // STEP 6: Parse the AI feedback and update the record
            const feedbackText = typeof feedbackResponse.message.content === 'string'
                ? feedbackResponse.message.content
                : feedbackResponse.message.content[0].text;

            data.feedback = JSON.parse(feedbackText);
            await kv.set(`resume:${uuid}`, JSON.stringify(data));

            // SUCCESS!
            setStatusText('Analysis Complete!');
            console.log("Analysis successful:", data);

            // Navigate to the results page on success
            navigate(`/resume/${uuid}`);

        } catch (err: unknown) {
            // This block now catches ALL errors from the try block
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            console.error("Analysis failed:", err);
            setError(`Error: ${errorMessage}`); // Set the user-facing error message
            setStatusText(""); // Clear the progress text

        } finally {
            // This block runs regardless of success or failure
            // It's the perfect place to stop the loading state, but we only do it on error
            // On success, we navigate away, so we don't need to set isProcessing to false.
            if (error) {
                setIsProcessing(false);
            }
        }
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        // Basic validation
        if (!companyName || !jobTitle || !jobDescription) {
            setError("Please fill out all fields.");
            return;
        }
        if (!file) {
            setError("Please upload your resume.");
            return;
        }

        handleAnalyze({ companyName, jobTitle, jobDescription, file });
    };

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen">
            <Navbar />
            <section className="main-section">
                <div className="page-heading py-16">
                    <h1><p>Smart Feedback</p></h1>

                    {/* PROCESSING STATE */}
                    {isProcessing && !error && (
                        <>
                            <h2><p>{statusText}</p></h2>
                            <img src="/images/resume-scan.gif" alt="Analyzing resume..." className="w-full max-w-md mx-auto mt-8"/>
                        </>
                    )}

                    {/* ERROR STATE */}
                    {error && (
                        <div className="text-center">
                            <h2 className="text-red-500 font-semibold"><p>{error}</p></h2>
                            <p className="mt-4 text-gray-600">Something went wrong. Please check the details and try again.</p>
                            <button onClick={handleReset} className="primary-button mt-6">
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* DEFAULT (IDLE) STATE */}
                    {!isProcessing && !error && (
                        <>
                            <h2><p>Drop your resume here for a rating!</p></h2>
                            <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                                <div className="form-div">
                                    <label htmlFor="company-name">Company Name</label>
                                    <input required type="text" name="company-name" id="company-name" placeholder="e.g., Google" />
                                </div>
                                <div className="form-div">
                                    <label htmlFor="job-title">Job Title</label>
                                    <input required type="text" name="job-title" id="job-title" placeholder="e.g., Software Engineer" />
                                </div>
                                <div className="form-div">
                                    <label htmlFor="job-description">Job Description</label>
                                    <textarea required rows={5} name="job-description" id="job-description" placeholder="Paste the job description here..."/>
                                </div>
                                <div className="form-div">
                                    <label htmlFor="uploader">Upload Resume</label>
                                    <FileUploader file={file} onFileSelect={setFile} />
                                </div>
                                <button className="primary-button" type="submit">Analyse</button>
                            </form>
                        </>
                    )}
                </div>
            </section>
        </main>
    );
};

export default Upload;