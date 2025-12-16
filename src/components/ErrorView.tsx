export const ErrorView = (Props: any) => {
    return <div className="border border-red-400 rounded bg-red-50 p-4 mb-4">
        <div className="text-red-800">{Props.content}</div>
    </div>
};