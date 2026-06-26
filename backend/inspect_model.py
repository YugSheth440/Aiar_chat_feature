import torch

def inspect_weights(file_path):
    print("=" * 60)
    print(f"[*] LOADING WEIGHTS FROM: {file_path}")
    print("=" * 60)
    
    try:
        # Load the PyTorch checkpoint dict headlessly on CPU
        checkpoint = torch.load(file_path, map_location='cpu', weights_only=False)
        
        # 1. Print keys in checkpoint dict
        print("\n[+] Checkpoint Keys:")
        for key in checkpoint.keys():
            val_type = type(checkpoint[key]).__name__
            print(f"  - {key:<15} : Type = {val_type}")
            
        # 2. Extract model info if present
        model = checkpoint.get('model', None)
        if model is not None:
            print("\n[+] Model Metadata:")
            # Extract classes mapping from model names attribute
            names = getattr(model, 'names', {})
            print(f"  - Classes Mapped : {names}")
            
            # Extract stride
            stride = getattr(model, 'stride', None)
            if stride is not None:
                print(f"  - Network Strides: {stride.tolist() if hasattr(stride, 'tolist') else stride}")
                
        # 3. Print metadata stats
        print("\n[+] Training Stats:")
        print(f"  - Training Epochs: {checkpoint.get('epoch', 'N/A')}")
        print(f"  - Best Fitness   : {checkpoint.get('best_fitness', 'N/A')}")
        print(f"  - YOLO Version   : {checkpoint.get('version', 'N/A')}")
        print(f"  - Export Date    : {checkpoint.get('date', 'N/A')}")
        
        # 4. Print subset of train arguments
        train_args = checkpoint.get('train_args', None)
        if train_args:
            print("\n[+] Selected Training Arguments:")
            essential_args = ['task', 'mode', 'model', 'data', 'epochs', 'imgsz', 'batch', 'device', 'optimizer']
            for arg in essential_args:
                if arg in train_args:
                    print(f"  - {arg:<12} : {train_args[arg]}")
                    
    except Exception as e:
        print(f"[!] Inspection failed: {e}")
        
    print("\n" + "=" * 60)

if __name__ == "__main__":
    inspect_weights("best.pt")
