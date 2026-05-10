import { FormEvent, useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { mcpAPI } from 'src/_support/mcp/mcp-api';

const MCP = () => {
    const [msg, setMsg] = useState('vendor: acme supplies');
    const [tool, setTool] = useState('tool1');
    const [argsText, setArgsText] = useState('{"message":"hello from test"}');
    const [out, setOut] = useState('Waiting...');

    const render = (title: string, data: unknown) => {
        const stamp = new Date().toISOString();
        const entry = `[${stamp}] ${title}\n${JSON.stringify(data, null, 2)}\n\n`;
        setOut(entry);
    };

    const callApi = async (title: string, request: () => Promise<{ status: number; data: unknown }>) => {
        render(title, { status: 'Running...' });
        try {
            const response = await request();
            render(`${title} (HTTP ${response.status})`, response.data);
        } catch (error) {
            render(`${title} (fetch error)`, { error: String(error) });
        }
    };

    const onHealth = async (e: FormEvent) => {
        e.preventDefault();
        await callApi('Step 1: GET /health', () => mcpAPI.health());
    };


    const onRunTool = async (e: FormEvent) => {
        e.preventDefault();
        let parsedArgs: unknown;
        try {
            parsedArgs = JSON.parse(argsText);
        } catch (error) {
            render('Step 3: invalid JSON in arguments', { error: String(error) });
            return;
        }

        await callApi('Step 3: POST /run_tool', () => mcpAPI.runTool(tool, parsedArgs));
    };

    const onChat = async (e: FormEvent) => {
        e.preventDefault();
        await callApi('Step 4: POST /chat', () => mcpAPI.chat(msg));
    };

    return (
        <div className="flex flex-col gap-6">
            <pre className="mt-3 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">{out}</pre>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <CardBox className="p-5 border-ld">
                    <h3 className="text-base font-semibold text-sidebar-foreground">Step 1: Agent Health</h3>
                    <form onSubmit={onHealth} className="mt-4">
                        <Button type="submit">GET /health</Button>
                    </form>
                </CardBox>


                <CardBox className="p-5 border-ld">
                    <h3 className="text-base font-semibold text-sidebar-foreground">Step 3: Direct MCP Tool Run</h3>
                    <form onSubmit={onRunTool} className="mt-4 flex flex-col gap-3">
                        <Input value={tool} onChange={(e) => setTool(e.target.value)} />
                        <Input value={argsText} onChange={(e) => setArgsText(e.target.value)} />
                        <div>
                            <Button type="submit">POST /run_tool</Button>
                        </div>
                    </form>
                </CardBox>


                <CardBox className="p-5 border-ld">
                    <h3 className="text-base font-semibold text-sidebar-foreground">Step 4: Chat Flow</h3>
                    <form onSubmit={onChat} className="mt-4 flex flex-col gap-3">
                        <Input
                            placeholder="Ask something..."
                            value={msg}
                            onChange={(e) => setMsg(e.target.value)}
                        />
                        <div>
                            <Button type="submit">POST /chat</Button>
                        </div>
                    </form>
                </CardBox>
            </div>
        </div>
    );
};

export default MCP;
